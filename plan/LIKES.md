# HistorAI — Story Likes & Interest-Based Match Pop-up

> Status: **approved for build.** Decisions confirmed by product owner (see §2).
> Scope: per-user likes on published stories, plus a post-like pop-up that surfaces
> **another user who liked the same story and shares interests** with the liker, with a
> one-tap path into the existing 1:1 messaging feature.
> Companion plans: [`CHAT.md`](./CHAT.md) · [`PROFILES.md`](./PROFILES.md) ·
> [`SAFETY.md`](./SAFETY.md). Tracker: [`README.md`](./README.md).

---

## 1. Product summary

The platform already connects generations through questions, answers and stories. Liking a
story is a low-effort signal of what a person cares about. This feature turns that signal
into a **human connection**:

- A signed-in user can **like** (and unlike) any published story.
- After a like, if **another user also liked the same story**, a pop-up names that person,
  shows their shared interests, and offers to **say hello** in a private chat.
- Matching is intentionally gentle: it only ever surfaces **one** person, and only when a
  like is made — never a directory of "everyone who liked this".

This is the "for a loneli-less world" loop made concrete: read → react → meet someone.

### Terminology

| Concept | Code | UI label |
|---------|------|----------|
| A user's like on a story | `StoryLike` / `like` | **Like** |
| Another liker surfaced after liking | `LikeMatch` / `match` | the pop-up |
| The chat entry point | reuses `ChatThread` / `MessageButton` | **Say hello** |

---

## 2. Confirmed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Like auth & semantics | **Signed-in only** (`river`/`drop`); **toggle** like/unlike; one like per `(storyId,userId)`. |
| 2 | Storage | **Separate `data/likes.json`** edge list (not embedded in stories/users). |
| 3 | "Similar interests" | Shared **profile interests between viewer and candidate** only (story topic not a factor in v1). |
| 4 | No-shared-interest fallback | **Show the most recent other liker** with `sharedInterests: []` (many profiles have no interests). |
| 5 | Pop-up frequency | **Once per story per browser session**, only when a match exists, only after a successful like. |
| 6 | Candidate exclusions | Exclude **self** and **blocked (either direction)**. Allow already-chatted users and the story author. |
| 7 | Safety model | **Allow all signed-in pairs** (consistent with `canSendTo`); add a **Report** affordance in the pop-up. |
| 8 | Placement | Like button on **feed cards (`/youth`) and story detail (`/youth/[id]`)**. Self-like allowed but self never matched. |
| 9 | Match selection | **Deterministic:** most shared interests, then most recent like. |
| 10 | Copy | Neutral, gender-free copy; **explicit shared-interest chips**. |

---

## 3. Data model

### New file: `data/likes.json`

```jsonc
{
  "likes": [
    { "storyId": "s-first-job", "userId": "u-seed-maya", "createdAt": "2026-10-23T10:00:00.000Z" },
    { "storyId": "s-first-job", "userId": "u-seed-harold", "createdAt": "2026-10-23T10:05:00.000Z" }
  ]
}
```

- Flat edge list, unique on `(storyId, userId)`. Duplicate writes are rejected in the store,
  so the count can never be inflated.
- Normalization: missing file / missing array → `{ likes: [] }` (fresh clone starts empty).
- All reads/writes go through the shared per-file lock (`mutateJson`) so concurrent likes
  cannot clobber each other.

### New types in `lib/types.ts`

```ts
export interface StoryLike {
  storyId: string;
  userId: string;
  createdAt: string;
}

// What the pop-up renders. `sharedInterests` is empty when the fallback applies.
export interface LikeMatch {
  user: PublicUser;
  sharedInterests: Topic[]; // { id, label } so the client needs no topic lookup
}

// Wire shapes
export interface StoryLikeState {
  liked: boolean;
  count: number;
}

export interface LikeStoryResponse {
  liked: boolean;
  count: number;
  match: LikeMatch | null;
}
```

---

## 4. `lib/likes.ts`

Mirrors the style of `lib/chat.ts` / `lib/questions.ts` (all writes under the file lock).

```ts
countLikes(storyId): Promise<number>
isLiked(storyId, userId): Promise<boolean>
likerIds(storyId): Promise<string[]>

// Batch, one read for the whole feed (avoids N+1 on /youth).
getLikeStates(storyIds: string[], viewerId: string | null): Promise<Record<string, StoryLikeState>>

// Idempotent set; returns the resulting count.
setLike(storyId, userId, liked): Promise<number>

// Matching (see §5). Returns null only when there is no eligible other liker.
findLikeMatch(storyId, viewerId): Promise<LikeMatch | null>
```

### Server-render helpers

`getLikeStates` is called once per feed page and once on the detail page so the button
renders with the correct filled/unfilled state and count without a client round trip.

---

## 5. Matching algorithm

`findLikeMatch(storyId, viewerId)`:

1. `likerIds(storyId)` → remove `viewerId`.
2. Remove anyone blocked in either direction (`isBlocked(viewerId, candidateId)`).
3. Load the viewer and candidates (`getPublicUserMap` for the public projection).
4. Score each candidate by `|viewer.interests ∩ candidate.interests|`.
5. Sort by **shared-interest count desc**, then **like recency desc**.
6. Take the top candidate.
   - If their shared count is `> 0` → `sharedInterests` = the intersection (as `Topic[]`).
   - If the top candidate has `0` shared interests → still return them with
     `sharedInterests: []` (**decision 4**), so users without interests are still reachable.

`findLikeMatch` returns `null` only when there is **no** other eligible liker.

Example: viewer likes `s-first-job`; Maya (Drops, interests `advice, job`) and Harold
(River, interests `job, travel`) also liked it; viewer's interests are `job, travel`.
Harold shares 2, Maya shares 1 → pop-up shows **Harold** with `Job & Career`, `Travel`.

---

## 6. API contract

New route: `app/api/stories/[id]/like/route.ts` — `export const runtime = "nodejs"`.

### `POST /api/stories/[id]/like`

- Guard: `authorize(["river", "drop"])`.
- Body: `{ "like": true | false }` (explicit and idempotent — no accidental toggling).
- Validates the story exists and is `published`; `404` otherwise.
- On `like: true`, after persisting, computes `findLikeMatch`.
- Returns **200** `LikeStoryResponse`.

```
POST /api/stories/s-first-job/like   { "like": true }
200 { "liked": true, "count": 3, "match": { "user": { ...PublicUser }, "sharedInterests": [ { "id": "job", "label": "Job & Career" } ] } }
```

Errors use the existing `{ "error": string }` shape:

| Status | When |
|--------|------|
| `400` | missing/non-boolean `like`, unknown story id shape |
| `401` | no session (client redirects to `/login`) |
| `404` | story missing or not published |

No new GET route: initial state is server-rendered via `getLikeStates`.

---

## 7. UI, routes & components

| Route | Change |
|-------|--------|
| `/youth` | `StoryCard` gains the like control; page passes per-story `StoryLikeState`. |
| `/youth/[id]` | Like control in the story header; page passes the state and (signed-in) viewer id. |

### New components (`components/`)

- **`like-button.tsx`** (client) — optimistic count, filled/unfilled heart in brand color,
  `aria-pressed`, modeled on `components/upvote-button.tsx`. Props:
  `storyId`, `initialLiked`, `initialCount`, `signedIn`.
  - `401` → `router.push("/login")` (same as `UpvoteButton`).
  - On a successful `like: true` with a `match`, and if
    `sessionStorage["historai:likeMatchSeen:<storyId>"]` is unset, open the dialog and set
    the key (**decision 5**).
- **`like-match-dialog.tsx`** (client) — native `<dialog>` (same pattern as
  `components/report-button.tsx`, so focus trapping + Escape come for free).
  Contents:
  - Heading: **“{Name} also liked this story.”**
  - Candidate: name, role + age band (never exact age), short bio.
  - Shared-interest chips when `sharedInterests.length > 0`; a neutral line otherwise.
  - Copy: *“Would you like to say hello?”* — gender-free.
  - Actions: **Say hello** (POST `/api/chat/threads` → `/messages/[threadId]`, reusing the
    logic in `components/chat/message-button.tsx`), **Not now** (close), and a small
    **Report** action (reuses `ReportButton` with `targetType="user"`).
  - `aria-labelledby` on the dialog title; announced politely.

### Styling / accessibility

- Reuses `ripple`, `glass`, `shadow-water`, and the existing type scale (18 px root,
  large tap targets).
- Like control is keyboard reachable with a visible focus ring and an `aria-label` that
  states the count, e.g. *“Like this story. 3 likes”* / *“Liked. 4 likes”*.
- Pop-up is a real dialog: Escape closes, focus is trapped, and the primary action is first.

---

## 8. Safety & privacy

- **Signed-in only.** Visitors can see counts but the like action routes them to `/login`.
- **No exact age** ever leaves the server — `toPublicUser` supplies the age band only.
- **Blocking wins.** A blocked user (either direction) is never surfaced as a match.
- **Consistency with chat.** The pop-up reuses `canSendTo`/`POST /api/chat/threads`, so the
  existing all-pairs messaging policy and its pre-send screening (`lib/chat-safety.ts`) apply
  unchanged. River↔Drop, Drop↔Drop and River↔River are all permitted, per `plan/CHAT.md`.
- **Minor-safety caveat carries over.** `plan/CHAT.md §14` still flags guardian consent for
  13–17 as an open item before any non-demo launch; this feature does not change that.
- **Discoverability is implicit consent.** Liking a published story makes you eligible to be
  surfaced to one other liker. This will be noted in the like control's title/help text.
- **One person, one nudge.** Only the top match is shown, only once per story per session,
  which keeps the feature from becoming a spammy "who viewed/liked" surface.

---

## 9. Seed data

Add `data/likes.json` with seed likes so the demo always yields a match:

- At least **two** seed users like each seeded story (`s-first-job`, `s-true-love`,
  `s-happiness`, …).
- Chosen so a typical demo viewer (interests `job`, `advice`, `travel`) matches on the first
  like they make.
- Because of decision 4, even a viewer with **no** interests gets a fallback match, so the
  pop-up is never a dead end in a live demo.

---

## 10. Build order

| Phase | Outcome | Touches |
|-------|---------|---------|
| **L1** | `data/likes.json` shape + `StoryLike`/`LikeMatch`/wire types | `data/`, `lib/types.ts` |
| **L2** | `lib/likes.ts` (counts, toggle, batch states, `findLikeMatch`) | `lib/` |
| **L3** | `POST /api/stories/[id]/like` | `app/api/stories/[id]/like/route.ts` |
| **L4** | `LikeButton` on `/youth` cards and `/youth/[id]`, server-rendered initial state | components + youth pages |
| **L5** | `LikeMatchDialog` + "Say hello" → chat + Report + session suppression | components |
| **L6** | Seed likes + end-to-end demo pass + `npm run build` | `data/`, QA |

---

## 11. Acceptance criteria

- **AC-LIKE-1** — A signed-in user can like and unlike a published story; the count is
  correct and no duplicate `(storyId,userId)` edge is ever stored.
- **AC-LIKE-2** — A visitor clicking like is sent to `/login`; `POST …/like` returns `401`.
- **AC-LIKE-3** — Liking a story that another eligible user also liked returns a `match` with
  the **most shared interests** (tie-break: most recent like).
- **AC-LIKE-4** — If no other liker shares an interest, the pop-up still shows the most recent
  other liker with an empty `sharedInterests` array (decision 4).
- **AC-LIKE-5** — Self and blocked users are never returned as a match.
- **AC-LIKE-6** — The pop-up appears at most once per story per browser session.
- **AC-LIKE-7** — "Say hello" opens or creates the 1:1 thread via the existing endpoint and
  lands on `/messages/[threadId]`.
- **AC-LIKE-8** — The pop-up is keyboard operable, Escape-closable, focus-trapped, and
  announces the match; exact age is never shown.
- **AC-LIKE-9** — Liking works from both the feed and the story detail page, and initial
  state is server-rendered (no flash of "not liked").
- **AC-LIKE-10** — `npm run build` passes and existing features (upvotes, feed, profiles,
  messaging) are unaffected.

---

## 12. Out of scope (deferred)

- A "who liked this" list on the story page.
- Notifications/emails when someone likes your story.
- Like-driven ranking or recommendations in the feed.
- Multi-user "you both liked" group suggestions.
- Storing the match decision server-side (suggestions are computed on demand).
- Real-time updates to like counts.
- Migration to a real database (the edge list maps directly to a join table later).

---

## 13. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Pop-up feels spammy or intrusive | One person, once per story per session, only after an explicit like; "Not now" is a first-class action. |
| Sparse profiles (no interests) make "similar interests" empty | Decision 4 fallback shows the most recent other liker with neutral copy instead of claiming shared interests. |
| Whole-file rewrite per like | Demo-scale accepted; `mutateJson` keeps writes safe; documented migration to a DB join table. |
| Proactive matching between minors and adults | Reuses the existing chat permission matrix and pre-send safety screening; Report in the pop-up; guardian-consent remains the documented open item (`CHAT.md §14`). |
| Duplicate/lost likes under concurrency | Unique edge + per-file lock; `setLike` is idempotent. |
| Surprising discoverability | Like control help text states that liking can surface you to one other liker. |
| Match always shows the same person in a demo | Deterministic is intentional (decision 9); seed data provides variety, and randomizing the top-N is a one-line follow-up. |

---

## 14. Open questions (do not block L1–L6)

1. **Randomize among the top matches?** Default: deterministic (decision 9). Revisit if demos
   feel repetitive.
2. **Exclude already-chatted users?** Default: no (decision 6). Could improve "new connection"
   rate later.
3. **Persist a "seen" flag server-side** instead of `sessionStorage`, so the pop-up shows once
   ever rather than once per session? Default: session-scoped for the demo.

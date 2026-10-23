# HistorAI — Round 2 Fixes: Search, Quick Links, Per-User Question Votes, Returning Login

Status: **implemented** — all decisions confirmed (see §12).
Scope: four reported inconsistencies in navigation, identity, and voting. No new
AI behavior. Adds one new data file (`data/question-votes.json`); no schema
changes to existing records.

Companion to [`UX-FIXES.md`](./UX-FIXES.md) (round 1) and [`LIKES.md`](./LIKES.md).

---

## 1. Summary

| # | Report | Surface | Severity |
|---|--------|---------|----------|
| **S1** | The header **Search** button does nothing (no handler, no target) | all pages (`components/site-header.tsx`) | medium (dead control) |
| **S2** | **Quick links** exist only in the home sidebar; not reachable from other screens | `/` only (`components/question-explorer.tsx`) | medium (navigation) |
| **S3** | Question **upvotes** are tied to the **browser** (`localStorage`), not the signed-in user | `/`, `/questions`, `/questions/[id]` | high (data correctness) |
| **S4** | `/login` always **creates a new account**; there is no way back into an existing profile | `/login`, `/onboarding` | high (identity) |

---

## 2. Root causes

**S1 — dead search button.** `components/site-header.tsx` renders
`<button aria-label="Search">` with an icon and no `onClick`, no `href`, no form.
It is decorative only. There is no `/search` route and no search helper.

**S2 — quick links are local, not global.** `QUICK_LINKS` and the
`<nav aria-label="Quick links">` live inside `components/question-explorer.tsx`,
which is rendered **only** by `app/page.tsx` (home). Every other route
(`/questions`, `/youth`, `/youth/[id]`, `/questions/[id]`, `/profile`,
`/messages`, `/connect`, `/senior`) has no quick links. The shared chrome is
`app/layout.tsx` → `SiteHeader` / `SiteFooter`.

**S3 — upvotes are browser-scoped.** `lib/questions.ts#upvoteQuestion` blindly
does `upvotes + 1` with no voter identity. The client
(`components/upvote-button.tsx`) dedupes with
`localStorage["historai:upvoted:<id>"]`, so:
- the same person on a second browser can upvote again;
- two people on one browser can't both vote;
- there is no way to **un-vote**;
- the server has no idea who voted.

This is exactly the problem that `plan/LIKES.md` solved for stories with
`data/likes.json` + `lib/likes.ts` + `POST /api/stories/[id]/like`.

**S4 — login is "sign-up only".** `/login` → `/onboarding` →
`OnboardingForm` → `POST /api/auth/login` → `createUser()` **always**. There is no
lookup of an existing user. The only thing that returns you to your account is
the 30-day signed session cookie. Clearing it (or another device) strands you.
`plan/PROFILES.md` §2 D8 explicitly said "multiple accounts/device — not needed
yet", so this was deferred, not forgotten.

---

## 3. Decisions

All confirmed by the user ("all as recommended").

| # | Decision | Choice | Status |
|---|----------|--------|--------|
| D1 | S1 outcome | **Implement** a `/search` page over questions + published stories (not just delete the button) | done |
| D2 | S1 user results | Include **public user profiles** in search results | done |
| D3 | S2 placement | Global **"Quick links" dropdown in the site header** (shared chrome), hidden on `/login` + `/onboarding` | done |
| D4 | S2 home sidebar | Keep the home sidebar quick links as a "featured" copy (accept minor duplication) | done |
| D5 | S2 visibility | Show public quick links to visitors/anonymous; hide "Your profile" when signed out | done |
| D6 | S3 store | New `data/question-votes.json` edge list `{ questionId, userId, createdAt }`, mirroring `data/likes.json` | done |
| D7 | S3 toggle | Make upvotes **toggleable** (vote / un-vote), like story likes | done |
| D8 | S3 count | Keep `question.upvotes` as the **denormalized count**, updated on each toggle (preserves existing sort); the vote store is the per-user truth | done |
| D9 | S3 client | Remove `localStorage`; render `voted` from the server per signed-in user | done |
| D10 | S4 mechanism | **Account chooser**: "Continue as an existing profile" list on `/login` | done |
| D11 | S4 scope | List **all** existing profiles (name + role + age band), demo-labelled | done |
| D12 | S4 fallback | Keep the current create-profile flow alongside the chooser | done |

---

## 4. S1 — Give the search button a job

**Approach (recommended): a server-rendered `/search?q=` page.** No client index,
no extra dependency — the file store is tiny and search is a substring match.

New `lib/search.ts`
```ts
export type SearchKind = "question" | "story" | "user";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;   // question text / story title / user name
  snippet: string; // short, plain-text context
  href: string;    // /questions/[id] | /youth/[id] | /profile/[id]
}

export async function search(query: string, limit = 40): Promise<SearchResult[]>;
```
- Normalise the query (`trim`, lowercase, min length 2).
- Sources:
  - **Questions** — `question.text`, resolved topic labels, asker name.
  - **Stories** — published only (`getPublishedStories()`): `metadata.summary`,
    `metadata.topic`, and the article body; title via `getArticleTitle`.
  - **Users** (if D2 = yes) — `name`, `bio`, `interests`.
- Rank: exact/title-prefix matches first, then title-substring, then body.
  Cap at `limit`; cap snippet length (~140 chars).

New `app/search/page.tsx`
- `searchParams: Promise<{ q?: string }>`; `export const dynamic = "force-dynamic"`.
- Renders a `<form action="/search" method="get">` input (works without JS),
  grouped results ("Questions", "Stories", "People"), and an empty state.
- `metadata.title = "Search"`.

`components/site-header.tsx`
- Turn the dead `<button>` into a `<Link href="/search" aria-label="Search">`
  (same styling). Optionally keep it a button that focuses the `/search` input,
  but a link is simplest and accessible.

Optional polish: show the query + result count; highlight the matched term.

---

## 5. S2 — Quick links on every screen (except login)

**Approach (recommended): extract a shared component and mount it in the header.**

New `components/quick-links.tsx`
```ts
const QUICK_LINKS = [
  { icon: "🔥", label: "Popular questions", href: "/questions?sort=popular" },
  { icon: "❓", label: "Unanswered",        href: "/questions?sort=unanswered" },
  { icon: "💬", label: "Recent answers",    href: "/youth" },
  { icon: "👤", label: "Your profile",      href: "/profile", signedInOnly: true },
];
```
- A `<details>`/popover or a small client dropdown labelled **"Quick links"**,
  keyboard-accessible, placed in the header next to the search control.
- `signedInOnly` entries are filtered out for visitors/anonymous (D5).

`components/site-header.tsx`
- Render `<QuickLinks signedIn={Boolean(user)} />`.
- Hide it on `/login` and `/onboarding` using the existing `usePathname()`:
  ```ts
  const hideQuickLinks = pathname === "/login" || pathname === "/onboarding";
  ```
- Keep the primary nav unchanged.

`components/question-explorer.tsx`
- **If D4 = keep:** leave the sidebar as is (home shows it twice, but the
  sidebar is the nicer placement and preserves the 3-column layout).
- **If D4 = move:** delete the `QUICK_LINKS` const + the `<nav>` and let the
  right column fall back to the community card only.

Reuse: import `QUICK_LINKS` from the new component in `question-explorer.tsx` so
the list lives in one place either way.

---

## 6. S3 — Per-user question votes

Mirror the proven story-likes design (`plan/LIKES.md`).

New `data/question-votes.json`
```jsonc
{ "votes": [ { "questionId": "q-first-job", "userId": "u-...", "createdAt": "ISO" } ] }
```

New `lib/question-votes.ts`
- `normalize()`, `readStore()` using `lib/json-file.ts` (`readJson` / `mutateJson`).
- `getVoteStates(questionIds, userId): Promise<Record<string, { voted: boolean; count: number }>>`
  — one read, no N+1 (same shape as `lib/likes.ts#getLikeStates`).
- `setVote(questionId, userId, vote): Promise<{ voted: boolean; count: number } | null>`
  — toggle membership; returns null for unknown question.
- `countVotes(questionId)`, `isVoted(questionId, userId)` for single reads.

`lib/questions.ts`
- Keep `upvoteQuestion` **or** replace with `adjustUpvotes(id, delta)` that the
  vote API calls inside the same logical operation. Recommend a small helper so
  the count update is explicit and testable.
- `upvotes` remains the denormalized count used by `getQuestions()` sorting.

`app/api/questions/upvote/route.ts`
- Require session (already does).
- Accept `{ id: string, vote?: boolean }`; when `vote` is omitted, **toggle**.
- Update the vote store and `question.upvotes` together; return
  `{ voted, count }` (mirror `LikeStoryResponse`).
- `404` unknown question, `401` no session, `400` bad body.

`components/upvote-button.tsx`
- Props: `questionId`, `initialCount`, **`initialVoted`**, **`signedIn`**.
- Remove all `localStorage` logic; `voted` starts from `initialVoted`.
- Optimistic toggle; `401` → `/login`; on failure revert.
- Copy: `aria-pressed`, "Upvoted" vs "Upvote", plus a hint that it is per-account.

Server pages — compute vote states for the signed-in user and pass them down:
- `app/questions/page.tsx` → `QuestionCard`
- `app/questions/[id]/page.tsx`
- `app/page.tsx` → `QuestionExplorer` (home) → `QuestionRow`
- `app/profile/[id]/page.tsx` if it lists that user's questions with counts
  (verify during implementation).

`components/question-card.tsx` / `components/question-explorer.tsx`
- Thread `initialVoted` through to `UpvoteButton`.

**Migration:** existing `question.upvotes` values stay as the starting counts;
`data/question-votes.json` starts empty (optionally seed a few votes for the
seed users so the per-user state is visible in the demo). No count is lost.

---

## 7. S4 — Sign in to an existing account (no passwords)

**Recommended: an account chooser.** This is the honest option given "no
passwords, no email, no DB": the app already knows who its users are, so let the
person pick theirs.

`app/login/page.tsx`
- Below the two role cards, add a **"Sign in to an existing profile"** section:
  a list/`<select>` of users (name, role icon, age band), plus a **Continue**
  button. Load with `listUsers()` + `toPublicUser()`.
- Keep the current "I'm a River / I'm a Drop → /onboarding" flow for new people
  (D12).
- Clear demo labelling: "Demo sign-in — pick a profile. No password."

New `app/api/auth/session/route.ts` (or extend `login`)
- `POST { userId }` → validate the user exists → `setSession({ userId, role })`
  → `200 { user: PublicUser }`. `404` unknown user, `400` missing id.
- Keep `POST /api/auth/login` (create) unchanged.

New `components/existing-account-picker.tsx` (client)
- Renders the list, handles the POST, then `router.push("/")` + `refresh()`.

**Security note (must be acknowledged):** this lets anyone sign in as anyone.
That is acceptable **only** because this is a passwordless demo with no private
data. If we want a fig leaf, we can require the user to also type the matching
**age** before granting the session (a weak shared secret). See Q6.

**Alternatives considered**
- *Name + age lookup* on the onboarding form: if a matching name exists, treat as
  returning. Fragile (duplicate names, typos) and surprising.
- *Optional PIN* set at signup: real login, but more UI + storage and contradicts
  "no passwords".
- *Magic link / email*: needs an email provider; out of scope.

---

## 8. Build order

1. **S3** (vote store + API + button) — highest correctness impact; also the
   cleanest template for the rest.
2. **S1** (`lib/search.ts` + `/search` + header link).
3. **S2** (`components/quick-links.tsx` + header mount + `question-explorer`
   refactor).
4. **S4** (account chooser + `/api/auth/session`).
5. Verify: `npx tsc --noEmit`, `npm run build`, runtime pass on the new routes,
   then restore any data files touched by tests.

S1–S4 are independent; order is a suggestion.

---

## 9. Acceptance criteria

- **AC-S1** — Clicking the header search opens `/search`; typing a term returns
  matching questions and published stories (and people, if D2 = yes); no query
  shows a prompt; an unmatched query shows an empty state. No dead controls.
- **AC-S2** — Quick links are reachable from every page **except** `/login` and
  `/onboarding`; hidden entirely on those two; "Your profile" hidden when signed
  out; keyboard-operable; the list is defined in exactly one place.
- **AC-S3** — A signed-in user can upvote once per question; the vote persists
  across browsers/sessions for that user; upvoting again (or toggling) un-votes;
  counts stay correct after toggle; visitors get `401` → `/login`; no
  `localStorage` voting remains.
- **AC-S4** — From `/login`, a returning person can select an existing profile
  and land signed in as that user; new people can still create a profile; an
  unknown `userId` is rejected; the session cookie is set as today.

---

## 10. Out of scope

- Real authentication (passwords, OAuth, email magic links, 2FA).
- Search relevance tuning, fuzzy matching, or a search index.
- Cross-device "log out everywhere", account deletion, or merging duplicates.
- Changing the story-likes feature (already per-user).

---

## 11. Risks

- **Impersonation (S4)** — by design, demo-only. Mitigate with clear labelling
  (and optionally the age check). Flag before any real launch.
- **Count drift (S3)** — the denormalized `question.upvotes` and the vote store
  could diverge if edited by hand. Mitigate by only mutating the count through
  the vote helper; add a cheap reconciliation note.
- **Duplicate quick links on home (S2)** — cosmetic; decide with D4.
- **Search over article bodies** may surface long text; keep snippets short and
  never render raw markdown.

---

## 12. Resolved decisions

1. **Search (D1):** implement a real `/search` page — questions + published
   stories first. ✅
2. **Search scope (D2):** include **public user profiles** in results. ✅
3. **Quick-links placement (D3):** header **dropdown** (global). ✅
4. **Home sidebar (D4):** keep the existing home sidebar quick links; the header
   covers the other screens. ✅
5. **Un-vote (D7):** question upvotes are **toggleable** like story likes. ✅
6. **Returning login (D10/D11):** an **account chooser**, clearly labelled
   "demo"; **no** age check. Real auth is still required before launch. ✅

# HistorAI — UX Fixes & Answer Sorting

Status: **approved** — all §3 decisions confirmed; F1–F4 implemented.
Scope: four reported bugs/UX gaps in the reader + moderation surfaces. No new AI
behavior, no data-model changes.

---

## 1. Summary

| # | Report | Surface | Severity |
|---|--------|---------|----------|
| **F1** | The themed water cursor renders **behind** open pop-ups (message/like-match and Report) | all pages | high (usability) |
| **F2** | Answers can't be sorted/filtered — should be sortable by **likes**, **topics**, and **date** | `/youth` (and optionally `/questions/[id]`) | medium |
| **F3** | Story likes are not shown on the **question thread**, only on `/youth` | `/questions/[id]` | medium |
| **F4** | Answers aren't linked to their source question; on the story page the question sits **below** the article instead of under the headline | `/youth`, `/youth/[id]` | medium |

F3 and F4 are direct extensions of the existing story-likes feature
(`plan/LIKES.md`); F1 is an independent presentation bug; F2 is new UI over
existing data.

---

## 2. Root causes

**F1 — top layer beats z-index.** `components/water-cursor.tsx` paints
`.water-cursor` (`z-index: 2147483647`) and `.water-drop-layer`
(`z-index: 2147483646`). Native `<dialog>` opened with `showModal()` is promoted
to the browser **top layer**, which is painted after *all* z-index stacking
contexts. So no z-index can put the cursor above a modal. This affects
`components/report-button.tsx` and `components/like-match-dialog.tsx` (and the
nested Report-inside-Like-match case).

**F2 — no answer sort/filter UI.** `app/youth/page.tsx` takes no `searchParams`
and always renders `getPublishedStories()` in its default order (createdAt
desc). Questions already have `QuestionFilterBar` + `?sort=` / `?topic=`
(`app/questions/page.tsx`, `components/filter-bar.tsx`); answers have no
equivalent.

**F3 — answer meta row omits likes.** `app/questions/[id]/page.tsx` renders each
answer's `ArticleRenderer`, author, date, MessageButton, and ReportButton — but no
`LikeButton`, and it never calls `getLikeStates`. Answers **are** `Story` records
(`answers = stories.filter(s => s.questionId === question.id)`), so the existing
`POST /api/stories/[id]/like` route and match pop-up already apply.

**F4 — no question linkage.** `components/story-card.tsx` receives only `story`,
`author`, and like state, so it cannot link to the source question. In
`app/youth/[id]/page.tsx` the question is rendered in an `<aside>` *after*
`<ArticleRenderer>`.

---

## 3. Decisions

Confirmed/recommended defaults. Items marked **ASK** are called out in §10.

| # | Decision | Choice | Status |
|---|----------|--------|--------|
| D1 | F1 mechanism | Promote cursor + droplet layer into the **top layer** via the Popover API (`popover="manual"` + `showPopover()`), re-promoting on dialog open | recommended |
| D2 | F1 fallback | If `showPopover` is unavailable, restore the **native cursor** while any `<dialog open>` exists and hide the custom one | recommended |
| D3 | F2 surface | Apply to **both** `/youth` and `/questions/[id]` | confirmed |
| D4 | F2 "topics" | Treat topics as **both** a sort mode (`topic` A→Z) and a topic **filter** on `/youth` | confirmed |
| D5 | F2 execution | **Server-side** via URL params (`?sort=&topic=`), mirroring `/questions` — avoids shipping article HTML to the client | recommended |
| D6 | F2 default | `newest` (createdAt desc) | recommended |
| D7 | F2 topic source | Canonical question `topicIds`; **not** free-form `story.metadata.topic` (values like "Career"/"Crime" don't match the topic taxonomy) | recommended |
| D8 | F3 | Add the existing `LikeButton` to each answer on `/questions/[id]`; reuse the story-like API and match pop-up unchanged | recommended |
| D9 | F4 question link | Add a compact “From the question: …” link on `/youth` cards (title still links to the story) | confirmed |
| D10 | F4 detail layout | Move the question directly under the headline, above the article; remove the bottom `<aside>` | recommended |

---

## 4. F1 — Keep the water cursor above modal dialogs

**Approach:** use the Popover API to join the top layer, then re-promote the
cursor whenever a modal opens so it is inserted *after* the dialog (later
top-layer entries paint on top).

`components/water-cursor.tsx`
1. In the effect (already gated to fine pointer + no reduced motion), set
   `cursor.setAttribute("popover", "manual")` and
   `layer.setAttribute("popover", "manual")`.
2. After grabbing refs: `layer.showPopover?.()` then `cursor.showPopover?.()`
   (drops below cursor).
3. Add a **capture-phase** `toggle` listener on `document`
   (`document.addEventListener("toggle", onToggle, true)`) — `toggle` does not
   bubble for `<dialog>`, but capture reaches it.
   - If `showPopover` **is** supported and `event.target` is an open
     `HTMLDialogElement`: `raise()` = for `[layer, cursor]`, if open then
     `hidePopover()`, then `showPopover()`. This moves both to the top.
   - If `showPopover` is **not** supported: toggle
     `document.documentElement.classList` `water-cursor-native` based on
     `document.querySelector("dialog[open]")`.
4. Cleanup: remove the listener, `hidePopover()` both elements, clear timers
   (existing), remove `water-cursor-active` (existing).

`app/globals.css` — override the popover UA box so positioning still works:
```css
.water-cursor[popover] {
  inset: auto; top: 0; left: 0;
  width: 28px; height: 36px;
  margin: 0; border: 0; padding: 0;
  background: transparent; overflow: visible;
}
.water-drop-layer[popover] {
  inset: 0; width: auto; height: auto;
  margin: 0; border: 0; padding: 0;
  background: transparent; overflow: hidden;
}
/* Fallback for browsers without the Popover API */
.water-cursor-native, .water-cursor-native * { cursor: auto !important; }
.water-cursor-native .water-cursor,
.water-cursor-native .water-drop-layer { display: none !important; }
```

**Notes / edge cases**
- Nested dialogs (Report launched from the like-match pop-up) work: the new
  dialog's `toggle` re-raises the cursor once more.
- `prefers-reduced-motion` and coarse pointers return early — native cursor,
  unchanged.
- If the Popover API exists but `showPopover()` throws (e.g. disconnected node),
  wrap in `try/catch` and fall through silently.

**Acceptance (AC-F1):** with either dialog open, the cursor and its click
droplets paint above the dialog; no console errors; dismissing the dialog leaves
the cursor working; unsupported browsers show the native cursor over dialogs.

---

## 5. F2 — Answer sorting (and topic filter)

Add a Link-based toolbar (server component) and drive ordering through URL
params, so no article HTML is serialized to the client.

### 5a. New helpers
- `lib/questions.ts` → `getQuestionMap(ids: Array<string | null | undefined>): Promise<Record<string, Question>>`
  — one read, no N+1, used by F2/F4.
- `lib/answers.ts` → small pure helpers:
  - `answerTopics(story, question): string[]` → canonical topic ids from the
    linked question (fallback to `[]`).
  - `topicLabel(topicId, topics): string` (or reuse existing lookup).

### 5b. `components/answer-sort-bar.tsx` (new)
Link-based, styled like `components/filter-bar.tsx`. Props:
```ts
{ topics: Topic[]; activeTopic?: string | null; activeSort?: string; basePath?: string }
```
- Sort options: `newest` (default), `likes`, `topic`.
- Topic chips: "All topics" + each topic (links preserving the current sort).
- Preserves the other param, exactly like `QuestionFilterBar.href()`.

### 5c. `/youth` (`app/youth/page.tsx`)
- Add `searchParams: Promise<{ sort?: string; topic?: string }>`.
- Fetch `getTopics()`, `getQuestionMap(story.questionId…)`, and like states.
- Filter by topic (`answerTopics` includes `topic`) when `?topic=` is set.
- Sort:
  - `newest`: `createdAt` desc (default).
  - `likes`: like count desc, then `createdAt` desc.
  - `topic`: topic label A→Z, then `createdAt` desc (answers without a topic last).
- Render `<AnswerSortBar basePath="/youth" … />` above the list.
- Empty-state message mentions active filters.

### 5d. `/questions/[id]` (recommended, **D3**)
- Add `searchParams: Promise<{ sort?: string }>` and sort the answers list:
  `newest` (default) / `likes`. Topic filtering is omitted here because every
  answer to a question shares the question's topics.
- Reuse `AnswerSortBar` with `basePath={`/questions/${question.id}`}` and no
  topic list.

**Acceptance (AC-F2):** `/youth?sort=likes` orders by like count;
`/youth?sort=topic` orders A→Z; `/youth?topic=travel` filters; the choice is
shareable/bookmarkable and survives reload; default remains newest-first. On
`/questions/[id]`, `?sort=likes` works.

---

## 6. F3 — Show answer likes on the question thread

`app/questions/[id]/page.tsx`
1. After `const answers = stories.filter(...)`, call
   `getLikeStates(answers.map(a => a.id), user?.id ?? null)`.
2. In each answer's meta row (next to `ReportButton`), render:
```tsx
<LikeButton
  storyId={answer.id}
  initialLiked={likeStates[answer.id]?.liked ?? false}
  initialCount={likeStates[answer.id]?.count ?? 0}
  signedIn={Boolean(user)}
/>
```
No API/type changes: answers are stories, so `POST /api/stories/[id]/like`,
`LikeMatchDialog`, and the `data/likes.json` store all work as-is.

**Acceptance (AC-F3):** each answer on `/questions/[id]` shows a like control
with the correct server-rendered count; liking optimistically updates and can
open the match pop-up; counts match `/youth`.

---

## 7. F4 — Link answers to their question

### 7a. `/youth` cards
- `components/story-card.tsx`: add optional prop
  `question?: { id: string; text: string } | null`.
- When present, render a compact eyebrow line under the summary, e.g.
  `From the question: <Link href={/questions/${question.id}}>{truncate(question.text)}</Link>`
  (style: small, brand-colored, `hover:underline`). The story title keeps
  linking to `/youth/[id]`.
- `app/youth/page.tsx`: resolve questions via `getQuestionMap` (shared with F2)
  and pass `question={…}`.

### 7b. `/youth/[id]` detail
- Move the question block **directly under the `<header>`**, before
  `<ArticleRenderer>`; render it compactly ("Answering:" + question text +
  inline link to `/questions/[id]`).
- Delete the old bottom `<aside>` to avoid duplication.
- Keep the author "want to know more" section where it is.

**Acceptance (AC-F4):** every `/youth` card whose story answers a question
exposes a working link to that question; on `/youth/[id]` the question appears
under the headline and above the article, and no longer appears at the bottom.

---

## 8. Build order

| Step | Work | Depends on |
|------|------|-----------|
| 1 | **F1** cursor top-layer fix + CSS | — |
| 2 | `getQuestionMap` helper | — |
| 3 | **F4a/F4b** question linkage | step 2 |
| 4 | **F3** answer likes on thread | — |
| 5 | **F2** sort bar + `/youth` (and `/questions/[id]`) | steps 2, 4 |
| 6 | Verify (below) + `npm run build` | all |

Verification: `npx tsc --noEmit`, `npm run build`, and a runtime pass (curl the
pages, open both dialogs to confirm the cursor, exercise `?sort=likes`,
`?sort=topic`, `?topic=…`, and answer likes on a question thread). Restore any
data files touched by manual testing.

---

## 9. Files expected to change

| File | Change |
|------|--------|
| `components/water-cursor.tsx` | popover promotion + toggle listener |
| `app/globals.css` | `[popover]` box overrides + native fallback |
| `components/answer-sort-bar.tsx` | **new** Link-based sort/topic toolbar |
| `lib/questions.ts` | add `getQuestionMap` |
| `lib/answers.ts` | add `answerTopics` (topic derivation) |
| `app/youth/page.tsx` | searchParams, filter/sort, pass question refs |
| `app/youth/[id]/page.tsx` | move question under headline |
| `components/story-card.tsx` | optional question link |
| `app/questions/[id]/page.tsx` | answer likes + optional sort |
| `plan/README.md` | link this plan |

---

## 10. Resolved decisions

1. **F2 scope (D3):** both `/youth` and `/questions/[id]` — the latter sorts by
   `newest`/`likes` only (its answers share the question's topics). ✅
2. **F2 "topics" (D4):** both a sort mode (`?sort=topic`, A→Z) and a filter
   (`?topic=<id>`) on `/youth`. ✅
3. **F4 card link (D9):** title keeps linking to the story detail; a compact
   “From the question: …” link is added under the summary. ✅
4. **F2 topic source (D7):** canonical topics from the linked question
   (`topicIds`), not `story.metadata.topic`; unfiled stories appear only under
   “All topics”. ✅

## 11. Out of scope

- A new like model for answers (we reuse story likes).
- Cleaning up `story.metadata.topic` / backfilling canonical topics.
- Persisting sort preference per user.
- Sorting questions (already has upvotes/top/new/unanswered).

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Popover API unsupported | native-cursor fallback class |
| Top-layer ordering with nested dialogs | re-promote on every dialog `toggle` |
| `metadata.topic` ≠ canonical topics | derive topics from the linked question |
| Shipping article HTML to the client for sorting | server-side sort via URL params |
| Count mismatch between `/youth` and thread | both call `getLikeStates` on the same store |

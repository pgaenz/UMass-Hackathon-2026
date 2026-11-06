# River experience plan: manage your stories, edit your words, keep the final say

**Status:** Implementation plan. Written for an implementing agent. Each phase is an approved
scope only once a separate request says so. Read the "Decisions" section before starting; it
records the defaults to use unless the product owner overrides them.

**Scope:** the River (older adult) role only. Drop and visitor improvements are separate plans.
Shared shell work (header, rail, mobile navigation) is referenced where it touches the River,
but its full design lives in [`header-navigation.md`](./header-navigation.md).

---

## 1. Goal

A River should be able to:

1. **Save an answer and come back to it.** An answer can be kept without writing or publishing a story.
2. **See everything they have written** in one place: unpublished and published stories, with a plain status for each.
3. **Edit the story directly.** The River has the final say on the words that represent them.
4. **Correct their own answer.** Voice transcripts often contain mistakes, and the story is only as faithful as the answer it came from.
5. **Publish, unpublish, or delete** on their own terms, with no action taken without a clear confirmation.

The River's loop becomes:

```text
Choose a question ─► Answer (speak or type) ─► Save for later, or write my story
                                                     │
                        My stories ◄─────────────────┘
                     (edit · check · publish · unpublish · delete)
```

---

## 2. Current state (verified in the code)

Use these facts to confirm the work before editing. If something here no longer matches the
code, trust the code and update this section.

| Area | What exists today | Gap |
|------|-------------------|-----|
| Answer form (`components/answer-form.tsx`) | Submitting calls intake and then generate in one flow. | No "save without writing". Text is cleared with `setText("")` after `submitBody`, which swallows errors, so a **failed submission discards the River's answer**. Audio is also reset with `resetAudio()` after the call. |
| Intake (`app/api/intake/route.ts`) | Creates a story with no article, so saving without writing is already possible at the API level. For audio, the story is created **before** transcription; if transcription throws, an empty story is left behind. | UI never uses the save-only path. Transcription failure leaves an orphan record and a generic error. |
| Review page (`app/senior/review/[id]/page.tsx`) | Loads any story by id. **No ownership check**, so any visitor who knows the id can open a River's draft. | Privacy gap. When `article` is empty it shows "We have not written the story yet." with **no action**. |
| Review actions (`components/review-actions.tsx`) | "Ask for a change" (AI rewrite with feedback), "Publish" / "Publish anyway". | No direct edit of the story or the answer. No unpublish. |
| Generate and approve (`app/api/generate/route.ts`, `app/api/approve/route.ts`) | Ownership check is `story.authorId && story.authorId !== ownerId`. A story with `authorId: null` passes for **any** River. | Ownership must be strict for mutating routes. |
| Store (`lib/store.ts`) | `getStoriesByAuthor`, `getStory`, `createStory`, `updateStory`, `appendFeedback`. | No delete. No version field (`updatedAt`). |
| Profile (`app/profile/page.tsx`) | "Your stories" lists every story with the raw status word (`reviewed`, `draft`). | Not an overview: no grouping, no actions, jargon. |
| Question cards (`app/senior/page.tsx`) | Every question says "Answer this question". | A River who already has a saved answer for a question cannot see it. |
| Likes, questions, conversations | `likes.json` keyed by `storyId`; `questions.json` `storyIds`; `conversations.json` `storyId` with audio paths. | Deleting a story must clean these up. |
| Uploads | Raw audio in `data/uploads/`, including feedback audio. | Deleting a story must remove its files, within `data/uploads/` only. |
| Seed data | 38 stories: 34 published, 3 reviewed, 1 draft. The draft (`u-seed-ruth`, `q-teenage-fun`) has **no article**. | Use these for manual testing. Do not modify the seed data. |

Story status values today are `draft | reviewed | published` (`lib/types.ts`). `reviewed`
means the accuracy check passed. `draft` is used both for "no article yet" and for "review did
not pass". The River-facing state must therefore be **derived**, not read straight from `status`
(see §5).

---

## 3. Decisions

These are the defaults. The implementing agent should follow them and flag any conflict.

| # | Question | Default (use this) | Alternative (only if the owner asks) |
|---|----------|--------------------|--------------------------------------|
| D1 | Editing a **published** story | Saving an edit **takes the story off Read stories** immediately. The editor states this before saving. The River publishes again when ready. | Keep the live version until a new version is published (requires storing a second copy). |
| D2 | Checks after a direct story edit | Safety check **always** runs on the saved text and is a hard gate. The accuracy check runs again and its result is shown with the timestamp. The River can still publish "anyway", as today. | Skip accuracy re-check for River-written text. |
| D3 | AI rewrite after manual edits | Asks for confirmation. The previous article is kept as **one** snapshot so the River can "Restore my previous version". | No snapshot; confirmation only. |
| D4 | Deleting | **Permanent**, with a confirmation. No trash. | 30-day recovery window. |
| D5 | Overview location | New page **`/senior/stories`**, titled "My stories". The River rail links to it. `/profile` shows a short list with a link to it. | Keep the list only on `/profile`. |
| D6 | Publishing from the overview | The overview **never publishes in one click**. "Review and publish" opens the review page, where the decision is made. | One-click publish from the list. |
| D7 | Reports on a deleted story | Existing reports stay on record for moderation. They are not shown to the River. | Delete them with the story. |

---

## 4. Principles to enforce

These come from `plan/river-drop-usability.md` and apply to every River change.

1. **The River owns the story.** Nothing is published or replaced without an explicit River action.
2. **Save first, check second.** A River's edit is persisted before any AI check runs. If a check fails, the edit is kept and the River sees "We could not check this version yet" with a retry.
3. **Enforce permissions on the server.** Hiding a button is not authorization. Every mutating route checks session, role, and **strict** ownership.
4. **Make only true privacy claims.** "Only you can see your drafts" may be shown **only after** the review-page ownership fix (Phase 0) is in place and verified. Do not say audio is deleted unless the delete cascade (§7.3) removes it.
5. **Plain words.** Use "Not published yet", "Ready to publish", "Published". Avoid "draft", "verdict", "grounding", "reviewed" in River-facing text.
6. **No dead ends.** Every state offers one clear next action.
7. **Accessible by default.** Large targets (at least 44px, ideally 48px), visible labels, keyboard operation, visible focus, no status conveyed by colour alone, works at A / A+ / A++.

---

## 5. Derived River story state

Create one pure helper, for example `lib/river-story-state.ts`, that maps a `Story` to a River-facing
state. Use it on the overview, the review page, the profile list, and the question cards. Do not
duplicate this logic in components.

| Condition (checked in this order) | State id | River label | Primary action |
|-----------------------------------|----------|-------------|----------------|
| `status === "published"` | `published` | "Published" | "View story" (secondary: Edit, Take off Read stories, Delete) |
| No article (`article` is empty) | `answer_saved` | "Answer saved. Not written yet." | "Write my story" |
| `safety.verdict === "block"` | `blocked` | "Can't be published as written" | "Edit story" |
| Checks missing or stale (see §7.2) | `needs_check` | "Needs checking" | "Check again" |
| `review.verdict !== "pass"` | `needs_changes` | "Needs changes" | "Edit story" (secondary: "Ask for a change") |
| `status === "reviewed"` | `ready` | "Ready to publish" | "Review and publish" |

Modifier flag `answerChangedSinceWriting` (true when the River edited the answer after the story was
written): show "Your answer changed. Write the story again?" on top of any state.

Add a stored hash or copy of the transcript at writing time to compute `answerChangedSinceWriting`.
A simple string comparison of the current transcript against the one used at writing time is acceptable.
Legacy records with `writtenFromHash: null` are treated as "not changed", so seeded stories are not flagged.

---

## 6. Data model changes

Add optional fields to `Story` in `lib/types.ts`. Add defaults in `normalizeStory` in `lib/store.ts`
so existing `data/stories.json` records keep working. **Do not rewrite the seed file.**

| Field | Type | Purpose |
|-------|------|---------|
| `updatedAt` | `string` (ISO) | Last change to any River-editable field. Defaults to `createdAt`. Used for sorting and optimistic concurrency. |
| `publishedAt` | `string \| null` | When it was last published. |
| `riverEdited` | `boolean` (default `false`) | True once the River has edited the story text directly. Shown as "You edited this story". |
| `checkedAt` | `string \| null` | When `review` and `safety` were last computed for the current article. `null` means checks are pending or failed. **Normalization default for legacy records:** `review ? review.createdAt : null`. Without this, every seeded reviewed story would be blocked from publishing by the new check in §7.2. |
| `checkError` | `string \| null` | Plain-language message when a check could not complete. |
| `writtenFromHash` | `string \| null` | Hash of the transcript used for the current article. Used for `answerChangedSinceWriting`. |
| `previousArticle` | `string \| null` | One snapshot for "Restore my previous version" (D3). |

Limits (validate on the server, document in the API section of `README.md`):

- `transcript`: 1 to 20,000 characters after trimming.
- `article`: 1 to 30,000 characters after trimming.
- Reject other types with 400.

---

## 7. Server work

### 7.1 Ownership helper (Phase 0)

Create `lib/story-access.ts` with one function, for example
`requireOwnedStory(storyId, userId): Promise<Story | Response>`:

- Missing story → 404.
- `story.authorId` is `null` or does not equal `userId` → 403 with "This story belongs to another River."
  Legacy content with `authorId: null` is **not editable, deletable, or publishable** by any River.
- Use this helper in: `generate`, `approve`, all new routes, and the review page (for pages, return
  `notFound()` instead of 403 so existence is not revealed).

Do not change behaviour for seeded stories: they all have an `authorId`.

### 7.2 Routes

Follow existing conventions: `authorize(["river"])` from `lib/session.ts`, JSON `{ error }` bodies,
`Response.json`. Document every route in `README.md` (the frozen `docs/api-contract.md` covers only
the original MVP routes).

| Route | Purpose | Notes |
|-------|---------|-------|
| `PATCH /api/stories/[id]` | Edit the answer (`transcript`) and/or the story (`article`). | Body: `{ transcript?, article?, expectedUpdatedAt }`. If `expectedUpdatedAt` does not match, return 409 "This story changed in another window. Reload to see the latest version." **Order:** (1) validate, (2) persist the edit with `updatedAt` and `riverEdited`, (3) if `article` changed, set `review`, `safety`, `checkedAt` to `null` and run checks (safety first, then accuracy, as in `runPipeline`), (4) store results, or store `checkError` if a check throws. Return the story. A failed check must **not** return an error that discards the saved edit. |
| `PATCH` on a **published** story | D1 behaviour. | Same as above, and also set `status` to `reviewed` or `draft` according to the new result and `publishedAt` to `null`. The response must say so. |
| `PATCH` with only `transcript` | Answer correction. | Do **not** touch `article`. Update `answerChangedSinceWriting` via the hash rule. Do not call an AI model. |
| `POST /api/stories/[id]/check` | Re-run checks on the current article. | Used by "Check again". Ownership required. |
| `POST /api/stories/[id]/unpublish` | Take off Read stories. | Requires `published`. Sets `status` to `reviewed` if `review.verdict === "pass"`, otherwise `draft`. Keeps likes and the question link. Returns the story. |
| `DELETE /api/stories/[id]` | Permanent delete (D4, D7). | Cascade in §7.3. Returns `{ deleted: true, id }`. |
| `POST /api/intake` (existing) | "Save for later". | Already creates a story with no article. The UI must **not** call `/api/generate` for this path. On audio transcription failure, keep the story and the audio, return 201 with `transcriptionFailed: true`, and let the River type the answer. Do not leave an unexplained empty record. |
| `POST /api/generate` (existing) | "Write my story", "Ask for a change", "Write the story again from my answer". | Use `requireOwnedStory`. Set `writtenFromHash`, `checkedAt`, `riverEdited: false`, and save `previousArticle` (D3) before overwriting. |
| `POST /api/approve` (existing) | Publish. | Use `requireOwnedStory`. Keep existing gates: `block` is never publishable; non-passing review requires `override: true`. **New:** reject with 409 "Check your story again before publishing" when `checkedAt` is `null` or `answerChangedSinceWriting` is true. Set `publishedAt`. |
| `POST /api/stories/[id]/restore` | Restore `previousArticle` (D3). | Swap `article` and `previousArticle`, then run checks. |

### 7.3 Delete cascade (D4, D7)

Implement `deleteStoryCascade(storyId)` in a server module, and call it from the `DELETE` route only.
Order matters:

1. **Remove the story record** from `data/stories.json` under the file lock (`mutateJson`). Public pages
   stop showing it immediately.
2. Remove likes for the story from `data/likes.json` (new function in `lib/likes.ts`).
3. Remove the story id from `Question.storyIds` (new function `unlinkStoryFromQuestion` in `lib/questions.ts`).
4. Remove conversation records with this `storyId` from `data/conversations.json` (`lib/conversations.ts`).
5. Delete files: `rawAudioPath`, each `feedback[].rawAudioPath`, and each conversation user-turn `audioPath`.
   **Only delete paths that resolve inside `data/uploads/`** (guard against path traversal). Missing files are
   not errors. Log other failures; do not fail the request, because the record is already gone.
6. Leave `data/reports.json` untouched (D7).

Confirm `lib/podcast.ts` builds episodes on each request from published stories with no cache. If it caches,
invalidate it here.

### 7.4 Transcription failure (intake)

Today `handleAudio` creates the story, saves the audio, then calls `transcribe`. If that throws, the route
returns 500 and the record stays. Change this to: keep the story and audio, set `transcript` to `""`,
return 201 with `transcriptionFailed: true`. The client then opens the answer editor with a message:
"We could not hear your recording clearly. Type your answer here, or record again." Adding a retry route is out of scope.

---

## 8. Pages and components

### 8.1 Answer form (`components/answer-form.tsx`) — Phase 0 and Phase 3

**Phase 0 (bug fix, required first):**

- Clear the typed answer only after a successful save. `submitBody` must return a success boolean (or the
  story id), and both handlers must act on it. On failure, keep the text and the recording.
- Keep the error visible and let the River retry.

**Phase 3 (features):**

- Replace the single submit with two buttons:
  - Primary: **"Write my story"**. Saves the answer, then generates the story and goes to the review page (current behaviour).
  - Secondary: **"Save answer for later"**. Saves the answer only, then goes to **My stories** with the notice
    "Saved. You can write your story whenever you are ready."
- Helper text under the buttons, in plain words: "Saving keeps your answer in My stories. Nothing is written or published until you choose."
- Unsent-answer warning: if the River has typed text or a recording and tries to leave, warn ("You have an answer
  that is not saved yet"). Use `beforeunload` for browser navigation and the in-app back link.
- Progress during "Write my story": show the steps in order, each with a text label and a state
  ("Saving your answer", "Writing your story", "Checking it"). Keep the page open while it runs. Do not promise how long it takes.
- Remove the duplicate "Your answer" label/heading wording, so the field label is distinct from the section heading.

### 8.2 My stories — new page `app/senior/stories/page.tsx` (Phase 2)

- Server component. Reads `getStoriesByAuthor(userId)` for the current River only. Legacy stories with no author are never shown.
- Heading: **"My stories"**. Intro: "Your answers and stories. Only you can see the ones that are not published."
  (Only use this sentence after Phase 0 is verified.)
- Filters as plain links, with counts: **All**, **Published**, **Not published yet**. Use `aria-current` on the active filter.
  Filter state in the URL (`?show=published`).
- Sort: most recently updated first.
- Each item is a card:
  - Title: the article title (`getArticleTitle`). If there is no article, use "Answer to: " plus the question text (truncated).
  - The question it answers, as a link to the question.
  - The state label from §5, as text, with the state icon optional and never alone.
  - "Last changed" date (`updatedAt`).
  - Actions, one primary and up to two secondary: see §5 table. Delete is always a secondary action at the end, styled as a destructive text button.
- Empty state (no stories): "You have not answered a question yet." with a button to **Find a question to answer**.
- Empty filter state: explain the filter and offer "Show all stories".
- Heading order and landmarks: `h1` "My stories", list in an `ul`.

### 8.3 Review page — `app/senior/review/[id]/page.tsx` (Phase 0 and Phase 4)

**Phase 0:** add the owner check. Non-owner or missing → `notFound()`.

**Phase 4 layout, top to bottom:**

1. Back link: "← My stories".
2. Status line using the §5 label, and the modifier if the answer changed.
3. **Your story**: the article rendered (existing `ArticleRenderer`), with an "Edit story" button.
   Show "You edited this story" when `riverEdited`.
4. **Your answer**: the transcript, with an "Edit my answer" button. If the answer changed since writing, show the
   rewrite prompt: "Write the story again from my corrected answer." (confirmation, see below).
5. Decision area (existing `ReviewActions`, reworked):
   - Primary: **"Publish this story"** when `ready`; **"Publish anyway"** (secondary, explicit) when `needs_changes`. Hidden when `blocked`.
   - Secondary: **"Ask for a change"** (AI rewrite, existing), **"Back to My stories"** (leaves without publishing).
   - Copy: "Nothing is published unless you choose it."
6. "What our checks found": keep, with the timestamp "Checked at 3:02 PM", and "Check again" when `checkedAt` is `null` or stale.
7. Published banner (when `published`): "Your story is published. Anyone can read it on Read stories." with
   **Take off Read stories** and **Delete story** actions.

**Story editor (inline, not a new page):**

- Activated by "Edit story". It must not be always-on, to avoid accidental edits.
- Two fields: **Title** (single line) and **Story** (multi-line). On save, compose the markdown as
  `# {title}\n\n{body}`. Check the title and body formats against the writing prompt in `prompts/writing_agent.md`
  and `getArticleTitle` in `lib/format.ts`, and keep the stored format identical.
- Helper text: "Your changes are saved first. Then we check them again. You still decide whether to publish."
- Buttons: **Save changes** (primary) and **Cancel** (secondary). Show "Saving…" then "Saved. Checking…" then the new state.
- Conflict (409): show "This story changed in another window" and the **Reload** button. Do not overwrite.
- Check failure after save: "Your changes are saved. We could not check them yet." with **Check again**.

**Answer editor (inline):**

- "Edit my answer" shows a textarea with the transcript and a note: "Fix any words that were heard wrongly."
- **Save my answer** saves only the transcript (no AI call). Then it shows the rewrite prompt if the story was already written.
- Rewrite confirmation, using D3 wording: "Write the story again from my answer? This replaces the story you see now, including your edits.
  The previous version is kept, so you can restore it." Buttons: **Write it again** (primary) and **Keep this version** (secondary, default focus).
- After a rewrite, show **"Restore my previous version"** as a secondary action, only when `previousArticle` exists.

**Publishing from this page requires `checkedAt` to be set and `answerChangedSinceWriting` to be false.** If it is not,
show the reason and the action to fix it (Check again, or Write the story again).

### 8.4 Delete and unpublish dialogs (Phase 2 and Phase 4)

- Use the existing dialog pattern (the native `<dialog>` used elsewhere in the project) with focus moved into the dialog,
  trapped while open, and returned to the trigger on close. Escape closes it.
- **Delete**, draft copy: title "Delete this story?". Body: "This permanently removes your answer and your story, and any recordings. This cannot be undone."
- **Delete**, published copy: add "Readers will no longer see it, and its likes will be removed."
- Buttons: **Keep story** (default focus, primary) and **Yes, delete it** (destructive, secondary styling). Do not use a red-only signal.
- After delete, return to **My stories** with the notice "Story deleted."
- **Take off Read stories** copy: "Readers will stop seeing this story. You can publish it again later." Buttons: **Take off** and **Keep publishing**.

### 8.5 Question cards on `/senior` (Phase 4)

- If the River has a story for this question that is not published, show "You have a saved answer for this question"
  with **Continue my answer** (to `/senior/review/[id]` if written, or to the answer form with the saved text if not).
- Otherwise keep "Answer this question".
- Use the derived state helper to decide, and keep the question list server-rendered.

### 8.6 Profile (`app/profile/page.tsx`) — Phase 2

- Replace the raw status badge with the §5 label.
- Show the five most recent stories with the overview link: **"See all my stories"**.
- If there are none: keep "You have not shared a story yet." with a link to **Find a question to answer**.

### 8.7 Navigation (River rail) — Phase 2

Update `navItemsFor` in `components/site-nav.tsx` for the River:

- Home
- **Answer a question** (`/senior`)
- **My stories** (`/senior/stories`), with a count of stories that are not published yet, as text.
- **Read stories**, Podcasts, Messages (unread badge)
- Secondary group: Search, Help (unchanged)
- **Remove "Browse questions" from the River rail.** `/senior` already lists all questions with a filter for
  "Needs an answer" and "Newest". Keep "See all questions" links on the River home.

Coordinate with `plan/header-navigation.md`. Mobile navigation below 1024px is a shared gap and is not part of this plan,
but the new "My stories" entry must be reachable wherever the rail is.

### 8.8 Tour and help copy

- Update the River tour in `lib/tutorial-steps.ts` ("Send it for review, then decide") to mention saving for later and My stories.
  Keep the tour short. Do not add a new required step.
- Update `app/help/page.tsx` with three River FAQ entries: "Can I save my answer and finish later?", "Can I change the story after I write it?",
  and "How do I take a story off the site or delete it?". Use the same words as the UI.

---

## 9. Copy reference

Use these phrases consistently. Change wording only with the product owner.

| Concept | Use | Avoid |
|---------|-----|-------|
| Saved text before writing | "Answer saved. Not written yet." | "Draft", "pending" |
| Generated story not yet published | "Not published yet" / "Ready to publish" | "Draft", "reviewed", "verified" |
| Public | "Published" / "Read stories" | "Live", "Feed" |
| Remove from site, keep content | "Take off Read stories" | "Unpublish", "Take down" |
| Permanent removal | "Delete story" | "Remove", "Trash" |
| AI rewrite | "Ask for a change" / "Write the story again" | "Regenerate", "Re-run" |
| Accuracy check | "Accuracy check" with "A passing check is not proof that a story is true." | "Verified", "Fact-checked" |
| Saving | "Save changes" / "Save my answer" | "Submit" |

---

## 10. Phases and order

Each phase must leave the app working. Run `npm run build` at the end of every phase.

| Phase | Scope | Done when |
|-------|-------|-----------|
| **0. Safety fixes** | Answer-form data-loss fix (§8.1). Review-page owner check (§8.3). Strict ownership helper for `generate`, `approve` (§7.1). Transcription-failure handling (§7.4). | A failed submit keeps the text. A non-owner gets 404 for `/senior/review/[id]`. A `null`-author story cannot be generated or approved by a River. |
| **1. Data and state** | New optional fields and normalization (§6). `lib/river-story-state.ts` (§5). `checkedAt`, `updatedAt`, `publishedAt` written by existing routes. | Existing data loads unchanged. The helper has offline test cases for every state. |
| **2. Overview and removal** | `/senior/stories` (§8.2). Unpublish route (§7.2). Delete route and cascade (§7.3). Dialogs (§8.4). Profile update (§8.6). Rail update (§8.7). | A River sees all their stories and can take off, delete, and open each one. Deleted stories leave no likes, question links, conversations, or audio files behind. |
| **3. Save for later** | "Save answer for later" and "Write my story" (§8.1). Unsent warning. Progress steps. | An answer can be saved without any AI call, then written later from My stories. |
| **4. Direct editing** | `PATCH` route (§7.2), story and answer editors (§8.3), rewrite confirmation and restore, `Check again`, question-card continue action (§8.5). | Edits are saved before checks run. Published edits take the story off Read stories. Answer edits make no AI call until the River asks. |
| **5. Copy, accessibility, tests** | Tour and Help (§8.8), copy reference (§9), accessibility pass (§11), tests (§12). | All acceptance criteria in §13 pass. |

---

## 11. Accessibility and usability requirements

- Every new control has a visible text label. Icons are decorative (`aria-hidden`).
- Status labels are text. Do not rely on colour for "published" vs "not published".
- Editors: labelled textareas, `aria-describedby` for helper text, character counts shown only near the limit.
- Save feedback in a live region (`role="status"`); errors in `role="alert"`. Focus moves to the error summary on validation failure.
- Dialogs: focus trap, Escape to close, focus returns to the trigger, default focus on the safe option.
- Touch and pointer targets at least 44px; keyboard order matches visual order.
- Works at A, A+, and A++ without horizontal scrolling at 1024, 1280, and 1440px widths.
- Reduced motion: no animated transitions for list changes or status updates.
- Microphone flows (answer and feedback recorders) keep their current denied-permission fallback: typing always remains available.

---

## 12. Testing

Follow the existing harness in `eval/` (see `eval/README.md`).

**Offline (`npm run eval`), add cases in `eval/main.ts`:**

- `deriveRiverState` returns the correct state for each row of the §5 table, including `answerChangedSinceWriting`.
- Ownership helper: owner allowed; other River 403; `authorId: null` 403; missing story 404.
- Cascade helper removes likes, question links, conversation records, and only files inside `data/uploads/`
  (test a path-traversal attempt).
- Article title composition round-trips through `getArticleTitle`.

**E2E (`npm run dev` then `npm run eval:e2e`), add cases in `eval/e2e.mjs`:**

- `PATCH`, `DELETE`, `unpublish`, `check`, and `restore` return 401 without a session, 403 for another River, and 403 for a `null`-author story.
- Editing a published story removes it from `GET /youth` and `/youth/[id]` returns 404 afterwards.
- Unpublish returns the story to "Ready to publish" or "Needs changes" according to its review.
- Delete removes the story from the feed, likes, question `storyIds`, and any conversation records.
- Saving an answer only (`POST /api/intake`) makes **no** call to `/api/generate` and produces a story with an empty article.
- Transcript-only `PATCH` makes no AI call (verify by stubbing or by timing and checking `article` is unchanged).
- A failed check after a successful save returns the saved edit with `checkError` set (simulate by setting an invalid model env or stubbing).

The E2E harness snapshots and restores `data/stories.json`, `users.json`, `likes.json`, `chat.json`, and
`question-votes.json`. **Add `questions.json` and `conversations.json` to that snapshot list** before testing the cascade.
Also clean up any files written to `data/uploads/` during the run.

**Manual checks (record results in the PR):**

- Answer by voice with microphone allowed, then save for later. Find it in My stories.
- Answer by voice with microphone denied. Type the answer, write the story, edit, publish.
- Publish a story, edit it, confirm it leaves Read stories, publish again.
- Delete a published story with at least one like; confirm it disappears from profile, feed, and the question's answer count.
- Open another River's review URL in a private window: expect "not found".
- Keyboard only: complete the whole loop and both dialogs without a mouse.
- A++ text size on every new page at 1280px and 1024px.
- Run through the seeded drafts: `u-seed-ruth` has an unwritten answer (`q-teenage-fun`) and reviewed stories to test.

**Build:** `npm run build` must pass.

---

## 13. Acceptance criteria

- **RA-1** A River can save an answer without generating or publishing anything, and find it under **My stories**.
- **RA-2** A River's typed or recorded answer is never discarded when a submission fails.
- **RA-3** **My stories** shows every story the River wrote, published and not published, each with one plain-language state and one clear next action.
- **RA-4** A River can edit the story text and the answer text directly. Saved edits are never lost because a check failed.
- **RA-5** Editing a published story takes it off Read stories until the River publishes it again. The River is told this before saving.
- **RA-6** No story is published without an explicit River action on the review page. The overview cannot publish in one click.
- **RA-7** A River can take a story off Read stories, or permanently delete it, after a clear confirmation. Deletion removes likes, question links, conversation records, and audio files.
- **RA-8** Only the owning River can open, edit, publish, unpublish, restore, or delete a story. Legacy stories with no author are not editable by any River.
- **RA-9** The "Only you can see your drafts" statement appears only after RA-8 is verified.
- **RA-10** Every River-facing state and button uses the copy in §9. No "draft", "verdict", "grounding", or "reviewed" appears in River-facing text.
- **RA-11** Accessibility requirements in §11 pass on the new pages.
- **RA-12** All tests in §12 pass and `npm run build` succeeds.

---

## 14. Non-goals

- Changing the writing, safety, or accuracy agents' prompts or thresholds.
- Changing the publish rules for safety-blocked stories (they stay unpublishable).
- Multiple drafts per question beyond one saved answer per attempt, or full version history (only one previous version, D3).
- Real authentication, database migration, or moving uploads off the local disk.
- Notifying a Drop when a River answers. Do not add this claim anywhere.
- Mobile navigation below 1024px (shared work; see `plan/header-navigation.md`).
- Drop and visitor changes (separate plans).

---

## 15. Open questions for the product owner

1. Confirm D1: does taking a story off Read stories on edit match what Rivers expect, or should the live version stay up until republished?
2. Confirm D4: is permanent deletion acceptable for the demo, or is a recovery window needed?
3. Confirm D5: should **My stories** also appear on the public profile (it should not, by default)?
4. Confirm the length limits in §6 with the writing agent's typical output.
5. Is a retry route for failed audio transcription wanted now, or later?

---

## 16. Handover checklist for the implementing agent

- [ ] Read `plan/river-drop-usability.md` and this file in full.
- [ ] Confirm §2 against the code; note any difference in the PR description.
- [ ] Phase 0 merged and verified before any other phase starts.
- [ ] No changes to `data/*.json` seed content, to agent prompts, or to safety and accuracy rules.
- [ ] New routes documented in `README.md` (route tables) with auth and error behaviour.
- [ ] Each phase: `npm run build`, `npm run eval`, and the E2E cases added in §12.
- [ ] Summarize changed paths, behaviour, validation performed, and known limitations in the PR.

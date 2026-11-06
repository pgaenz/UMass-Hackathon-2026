# Drop experience plan: ask well, follow your question, learn from stories

**Status:** Implementation plan. Written for an implementing agent. Phases are approved only once a
separate request says so. Read "Decisions" first. Phase 0 contains safety decisions that must be
answered before any Drop-facing feature is extended.

**Scope:** the Drop (young person, ages 16–30) role only. The River role is covered by
[`river-experience.md`](./river-experience.md). Shared shell work (header, rail, mobile navigation) is
referenced where it touches Drops; its design lives in [`header-navigation.md`](./header-navigation.md).

---

## 1. Goal

A Drop should be able to:

1. **Ask a good question quickly**, and know it is worth asking (no duplicates, clear topics).
2. **Follow what happens to the question**: is it waiting, answered, or where is the story that answers it.
3. **Learn from stories** that answer real questions, from the question or from the story.
4. **Manage their own questions**: fix a typo or withdraw a question, within clear limits.
5. **Reach a River safely** when they want more than a story says, without exposing personal information.

The Drop loop becomes:

```text
Ask a question ─► My questions shows it is waiting ─► A River answers ─► Story appears
      │                                                                      │
      └──────────── Browse questions · Read stories · Message a River ◄──────┘
```

---

## 2. Current state (verified in the code)

Confirm each row before editing. If the code has changed, trust the code and update this section.

| Area | What exists today | Gap |
|------|-------------------|-----|
| Ask form (`components/ask-question-form.tsx`) | Textarea with `maxLength={300}` (client only), optional topic checkboxes, success message "Your question was posted. Thank you!", then `router.refresh()`. | No server-side length or topic validation. No guidance on what makes a good question or what happens next. The new question stays on the same page and, under the default "Most popular" sort, sorts to the bottom with 0 upvotes. |
| Question API (`app/api/questions/route.ts`) | Drops only (`authorize(["drop"])`). Safety check, with one automatic rewrite for soft issues. `askedBy` taken from the session. | `topicIds` are filtered to strings only; unknown topic ids are stored. Text length is not checked on the server. No duplicate check. No edit or withdraw route. |
| Questions data (`lib/questions.ts`) | `createQuestion`, `getQuestionsByUser`, `adjustUpvotes`, `linkStoryToQuestion`. | No update, no delete, no `updatedAt`. |
| `/questions` (`app/questions/page.tsx`) | Ask form placed **above** the browse list, so Drops scroll past the form to browse. Browse has `id="browse"`. | Asking and browsing compete on one page. |
| Drop home (`components/home/drop-home.tsx`) | Hero "Ask a question" + "Browse questions", stories, "Questions you can follow" (top 3 by upvotes). | No "My questions". "Questions you can follow" implies a follow feature that does not exist. |
| Profile (`app/profile/page.tsx`) | "Your questions" list for Drops with `QuestionCard` and an "Ask one" link when empty. | Not an overview; no status words beyond the answer count; not linked from home. |
| Question card (`components/question-card.tsx`) | "asked by **{full name}**" linking to the Drop's profile, plus Copy, Listen and Report in a small row. | Public display of a young person's full name with a profile link. See D2. |
| Question detail (`app/questions/[id]/page.tsx`) | Answers listed; "Ask {first name} a Question?" button next to each answer author. | The button label implies a **public question**, but it opens a **private message thread**. The asker gets no status ("3 answers. Your question was answered.") beyond the count. |
| Story page (`app/youth/[id]/page.tsx`) | "Want to know more about {name}?" with the same "Ask … a Question?" button. | Same label problem. |
| Messaging rules (`lib/chat.ts`) | `canMessage(_a, _b)` returns **`true` for every pair**, including Rivers messaging Drops under 18. The server (`app/api/chat/threads/route.ts`) relies on this. | **Safety gap** for 16–17-year-old Drops. See D1. `canMessage` does not receive ages, so it cannot enforce an age rule today. |
| Connect (`app/connect/page.tsx`) | Directory of Rivers, sorted by shared interests. Reachable only from the Messages page. | Drops have no visible route to find a River. Exact ages are not shown (age bands only), which is correct. |
| Browse sort | Default "Most popular" (upvotes). "Needs an answer" is explained. | New questions start at 0 upvotes and are hard to find. |
| Tour (`lib/tutorial-steps.ts`, Drop track) | "Ask a question" step targets `[data-tour="ask-form"]` on `/questions`. | Must follow any route change. |
| Seed data | 43 questions: 11 have no answers, 8 have no `askedBy` ("Asked by the community"). | Use for manual tests. Do not change seed data. |

---

## 3. Decisions

Defaults are listed. Blocking decisions (marked **Blocker**) must be confirmed by the product owner and,
for D1 and D2, reviewed by whoever is responsible for youth safety, before Phase 3 or later ships.

| # | Topic | Default (use this) | Note |
|---|-------|--------------------|------|
| **D1** | **Blocker.** Adult-initiated contact with minors | A **River cannot start a new thread with a Drop under 18** (the only minors in the 16–30 range are 16–17). Enforced on the server, in thread creation and message sending. Drops can still message Rivers, and all messages keep the existing screening. Existing threads are not changed. | Needs a product and safety decision. Adults messaging minors is the main risk in this product. Until decided, Phase 5 stays blocked and the "Message" buttons for Rivers messaging Drops stay hidden. |
| **D2** | **Blocker.** How a Drop's name appears publicly | On public surfaces (question cards, question detail, story pages, search results), a Drop is shown as **first name and last initial** (e.g. "Maya C."). For Drops under 18, the name does not link to their profile. The profile page itself shows only what the Drop chose to publish. | Profiles can contain free-text bios. Add a short notice in onboarding that bios are public. |
| D3 | Edit a question | Allowed **only while no story (any status) is linked** to it. The edited text runs through the same safety screen as posting. Upvotes are kept. `editedAt` is set and shown as "Edited". | |
| D4 | Withdraw a question | Allowed **only while no story (any status) is linked**. Permanent. Removes the question, its votes, and its entries from any lists. If a story is linked, the button is disabled with the reason. | A withdrawn question cannot be recovered. Confirm with a dialog. |
| D5 | Topic on posting | **Recommended, not required.** The form asks for at least one topic with a plain explanation: "Topics help Rivers find your question." Unknown topic ids are rejected. | Make it required only if the owner asks. |
| D6 | Duplicate check | Show **up to 3 similar existing questions** while the Drop types (debounced, after 15 characters). It never blocks posting. Matching uses the existing search helper and a simple keyword overlap. | |
| D7 | Where asking lives | New page **`/questions/new`** for asking. **`/questions`** becomes browse-only with a prominent "Ask a question" button. | Avoids the form competing with browsing. |
| D8 | Overview | New page **`/questions/mine`** titled "My questions", shown in the Drop rail. Also linked from the Drop home and the profile. | Static segment `mine` and `new` take precedence over `[id]`. |
| D9 | "Follow" or notifications | **Not built.** Status is shown on My questions and on the question page when the Drop visits. No notification, email, or "you have a new answer" claim is made anywhere. | If the owner later wants alerts, it is a separate plan. |

---

## 4. Principles to enforce

1. **Be honest about what happens next.** Allowed: "Rivers can see your question on Answer a question." Not allowed: "A River will reply to you," or any notification claim.
2. **Protect young people first.** Age-aware rules live on the server. Public names are minimised. Messaging with minors follows D1.
3. **Permissions are enforced on the server.** Hidden buttons are not authorization. Every mutating route checks session, role `drop`, and ownership.
4. **Save first, check second, never lose text.** A question that fails the safety screen is returned with its text so the Drop can fix it. Nothing typed is cleared on error.
5. **Plain words.** "Ask a question", "Waiting for a River", "Answered", "Send a message". Avoid "upvote" without explanation, "thread", "pair", "verdict", "moderation".
6. **Every state has a next step.** Waiting, answered, empty, withdrawn, error.
7. **Accessible by default.** Visible labels, keyboard operation, focus management in dialogs, text-size support (A / A+ / A++), no colour-only status, 44px targets.

---

## 5. Derived question state

One pure helper, for example `lib/drop-question-state.ts`, used by My questions, the Drop home, the question
detail page (for the asker), and the profile. Do not duplicate this logic in components.

Inputs: the question, its linked stories (`storyIds` plus `questionId` on stories), and whether a story is published.

| Condition (checked in order) | State id | Label | Next action |
|------------------------------|----------|-------|-------------|
| At least one **published** linked story | `answered` | "Answered · {n} stories" | "Read the story" (first by newest) |
| Linked stories exist but none published | `in_progress` | "A River is writing an answer" | none (informational) |
| No linked stories | `waiting` | "Waiting for a River" | "Browse similar questions" (secondary) |

Modifiers: `edited` (show "Edited"), `hasTopics` (if none, show "No topics yet" and an "Add topics" action).

Note: `in_progress` must not reveal the River's draft text. It only says that an answer is in progress, which
is the same level of detail the River's own overview shows to the public (nothing).

---

## 6. Data model changes

Add optional fields to `Question` in `lib/types.ts`. Normalize in `lib/questions.ts` so existing records load unchanged.
**Do not modify `data/questions.json`.**

| Field | Type | Purpose |
|-------|------|---------|
| `updatedAt` | `string` | Defaults to `createdAt`. |
| `editedAt` | `string \| null` | Set when the text is edited (D3). |

Public display: add a helper `publicDisplayName(user)` (first name plus last initial, per D2) and use it on every
public surface. The profile page keeps the full name only for the signed-in user.

---

## 7. Server work

### 7.1 Shared screening and validation (Phase 0)

Extract the safety logic from `POST /api/questions` into one helper, for example `screenQuestionText(text)`, that returns
`{ ok: true, text, notice? } | { ok: false, status, error }`. Use it in POST and PATCH.

Validation (applies to create and edit, return 400 with plain messages):

- `text`: 8 to 300 characters after trimming. Message: "Please write a little more, at least 8 characters." / "Please keep your question under 300 characters."
- `topicIds`: array of strings, each must exist in `data/questions.json` topics, at most 5. Unknown ids → 400. Empty allowed unless D5 is changed.

### 7.2 Messaging age rule (Phase 0, D1)

- Change `canMessage` to take the viewer and target **users** (role and age), not only roles. Keep the function pure and unit-tested.
- Rule: if the **initiator** is a River and the **target** is a Drop under 18, the thread is refused (403, "You cannot start a conversation with this person.") Use the same message for any refusal, to avoid revealing age.
- Apply in `POST /api/chat/threads` (creation) and `POST /api/chat/threads/[id]/messages` when a new thread would be created. Existing threads continue.
- Ages are never exposed in responses. Use `ageBand` for display only.
- The UI hides "Message" for a River when the target is a Drop under 18 (`canSendTo` uses the same function). The server rule is authoritative.

### 7.3 Routes

Follow existing conventions (`authorize(["drop"])`, JSON `{ error }`, `Response.json`). Document in `README.md`.

| Route | Purpose | Notes |
|-------|---------|-------|
| `GET /api/questions/similar?text=…` | Up to 3 similar questions (D6). | Public read (visitors may call it). Returns id, text (truncated), topic labels, answer count. Never returns `askedBy`. Empty for fewer than 15 characters. |
| `PATCH /api/questions/[id]` | Edit text and/or topics (D3). | Owner only (`askedBy === session.userId`; community questions with `askedBy: null` are not editable). Refused with 409 if any linked story exists. Runs `screenQuestionText`. Sets `editedAt`. Returns the question. |
| `DELETE /api/questions/[id]` | Withdraw (D4). | Owner only. Refused with 409 if any linked story exists. Removes the question, its `question-votes.json` entries, and returns `{ deleted: true, id }`. |
| `POST /api/questions` (existing) | Create. | Uses `screenQuestionText`. Keep the existing 422 and 502 behaviour. Return `question` plus `notice`. |

Ownership check for PATCH and DELETE is strict: `askedBy` must equal the session user id. Use 404 for unknown ids and 403 for
other people's questions.

### 7.4 Public display

Update every public surface to use `publicDisplayName` (D2): `QuestionCard`, question detail, story page, search results
(`lib/search.ts`), and the profile link rules. For Drops under 18, render the name as text without a link.

---

## 8. Pages and components

### 8.1 Ask a question — `/questions/new` (Phase 2)

- Server page with `requireRole("drop")` (existing helper in `lib/session.ts`). Non-Drops are redirected as they are today.
- Heading: **"Ask a question"**. Intro: "Ask something you would really like an older person's experience of. Rivers will see it on Answer a question."
- Form fields, in order:
  1. Question (textarea, visible character count "37 of 300", `aria-describedby` for the hint: "Write it as you would say it aloud.").
  2. Similar questions panel (D6). Shown as links that open in the same tab. Heading: "Someone may already have asked this." With a line "If one of these answers your question, you can read it." Hidden when there are no matches.
  3. Topics (checkboxes as today) with the helper text from D5.
  4. Submit: **"Post my question"**.
- Success: redirect to **`/questions/mine`** with the notice "Your question is posted. Rivers can see it on Answer a question." and the new question highlighted at the top.
- Failure: keep the text and topic selections. Show the error in `role="alert"` and focus it.
- Remove the success text "Thank you!" from the form: it is not needed.

### 8.2 My questions — `/questions/mine` (Phase 3)

- Heading: **"My questions"**. Intro: "Questions you have asked, and what has happened to them."
- Sections by state (§5), each with a plain heading and count: "Waiting for a River", "A River is writing an answer", "Answered".
  Use a single list with a visible state label on each item if sections feel heavy at large text sizes; the agent decides and records the choice.
- Each item: question text (link to the question page), topic labels, "Edited" if applicable, last changed date, state label, and actions:
  - **Read the story** (answered), **Edit question** (D3), **Withdraw question** (D4), **See similar questions** (waiting).
  - Disabled actions show the reason in text next to them, e.g. "A River has started an answer, so this question can no longer be changed."
- Empty state: "You have not asked a question yet." with **Ask a question**.

**Edit dialog:** a native `<dialog>` with a textarea (same validation as posting), topic checkboxes, **Save changes** and **Cancel**.
The safety screen may rewrite soft issues; show the existing notice text when that happens.

**Withdraw dialog:** title "Withdraw this question?", body "It will be removed for everyone. This cannot be undone." Buttons: **Keep question** (default focus) and **Withdraw it** (destructive styling plus text, not colour alone).

### 8.3 Browse questions — `/questions` (Phase 4)

- Browse only. Heading "Questions". Intro: "Read questions from young people. Choose one to read the answers, or ask your own."
- Top button: **Ask a question** (links to `/questions/new`), above the filters. For visitors and Rivers, keep the existing sign-in and "Rivers answer" card text, but place it below the browse list so it does not block browsing.
- Filters unchanged. Sort labels unchanged, plus a plain explanation for "Most popular": "Questions Rivers and others have upvoted most."
- Newly asked questions: show a small text badge "New" for seven days (relative to `createdAt`). Do not use colour alone.

### 8.4 Drop home — `components/home/drop-home.tsx` (Phase 4)

- Hero: keep "What would you like to learn from someone who's been there?" with **Ask a question** (primary) and **Browse questions** (secondary).
- New section near the top: **"Your questions"** using the derived state, showing up to three most recent with a link to **See all my questions**. Hidden when empty, and replaced by an invitation to ask.
- Rename "Questions you can follow" to **"Popular questions"** with the explanation "Upvoted most by others. Read the answers, or ask something similar." Remove any wording implying a follow feature.
- Keep "Stories that answer real questions" as is.
- Remove the duplicate "Browse questions" links that point to `#browse` (the anchor is no longer on the same page).

### 8.5 Question detail — `app/questions/[id]/page.tsx` (Phase 4)

- Asker's view (signed-in asker only): a banner using the §5 state: "Your question has {n} answers. Read them below." or "Waiting for a River. Rivers can see your question on Answer a question." Edit and Withdraw links appear here as well, when allowed.
- Button label change (all places): "Ask {first name} a Question?" becomes **"Send {first name} a message"**, with the sub-line "Private message. Only you two can see it." (Only shown when D1 allows the contact.)
- Asker name follows D2 publicly.
- Answers list: keep as is. Replace "Asked by …" with D2 display.

### 8.6 Story page — `app/youth/[id]/page.tsx` (Phase 4)

- Same label change as §8.5. Heading "Want to know more about {name}?" becomes "Send {first name} a message" with the same sub-line.
- Keep the "From the question" link on story cards (already good).

### 8.7 Connect and Messages (Phase 5, after D1)

- Messages empty state: "Find a River to talk with" with **Find a River** (`/connect`). Keep the text honest: "Rivers are adults. You can message them privately. Messages are checked for safety."
- Connect page (Drop view): keep the directory. Add a one-line explanation "Only age bands are shown." and hide any River the rule in D1 would block (for Drops this does not apply).
- Do **not** add Connect to the Drop rail in this plan. Revisit after D1 has been in place and tested.

### 8.8 Navigation (Drop rail) — Phase 4

Update `navItemsFor` in `components/site-nav.tsx` for Drops:

- Home
- **Ask a question** (`/questions/new`)
- **My questions** (`/questions/mine`)
- **Browse questions** (`/questions`)
- Read stories, Podcasts, Messages (unread badge)
- Secondary group: Search, Help

Coordinate with `plan/header-navigation.md` and `plan/river-experience.md` (same rail component).

### 8.9 Tour, Help and copy (Phase 6)

- Update the Drop track in `lib/tutorial-steps.ts`: the ask step targets `/questions/new`, and the "Find questions you care about" step targets browse. Add one step for My questions. Keep the tour short.
- `app/help/page.tsx`: add Drop FAQ entries: "Can a River see my name?" (D2 answer), "Can I change or withdraw my question?" (D3/D4), "Can I message a River?" (D1, written exactly as the rule is implemented), and "What happens after I post?" (no notification promise).
- Replace copy: "Thank you!", "Ask … a Question?", "Questions you can follow", "Asked by the community" (keep for `askedBy: null` only).

---

## 9. Copy reference

| Concept | Use | Avoid |
|---------|-----|-------|
| Posting | "Post my question" | "Submit" |
| Waiting | "Waiting for a River" | "Pending", "Open" |
| Answer in progress | "A River is writing an answer" | "Draft", "in review" |
| Answered | "Answered · 2 stories" | "Resolved", "Closed" |
| Private contact | "Send {first name} a message" | "Ask … a Question?", "Thread", "DM" |
| Public name | "Maya C." | Full name |
| Removing | "Withdraw question" | "Delete", "Remove" |
| Upvote | "Upvote" with the explanation on Popular questions | Unexplained "upvotes" |

---

## 10. Phases and order

Run `npm run build` at the end of every phase.

| Phase | Scope | Done when |
|-------|-------|-----------|
| **0. Safety decisions and server rules** | Confirm D1 and D2 (blockers). Shared screening helper and question validation (§7.1). `canMessage` age rule (§7.2). Public display helper applied on every public surface (§7.4). | Question text and topics are validated on the server. A River cannot start a thread with a Drop under 18 (API tested). Drop names are shown in the D2 form on all public surfaces. |
| **1. Data and state** | `Question` fields and normalization (§6). `lib/drop-question-state.ts` (§5). Search helper reuse for similar questions. | Existing data loads unchanged. The state helper has offline tests for every state. |
| **2. Ask flow** | `/questions/new` (§8.1), similar-questions route (§7.3), redirect to `/questions/mine`. | A Drop can ask, see similar questions, and land on My questions with the new question visible. |
| **3. My questions** | `/questions/mine` (§8.2), `PATCH` and `DELETE` routes (§7.3), edit and withdraw dialogs, profile link. | A Drop can edit while unanswered, withdraw while unlinked, and sees the status of every question they asked. |
| **4. Browse, home and labels** | `/questions` browse-only (§8.3), Drop home (§8.4), question detail and story page copy (§8.5, §8.6), Drop rail (§8.8). | No duplicate "Browse" anchors. The message button label is corrected everywhere. The rail matches §8.8. |
| **5. Messaging and River discovery** | Messages empty state, Connect Drop view (§8.7). Only after D1 is live. | Drops can find a River and message one, and the D1 rule is visible and enforced. |
| **6. Tour, Help, accessibility, tests** | §8.9, accessibility (§11), tests (§12). | All acceptance criteria in §13 pass. |

---

## 11. Accessibility requirements

- All new controls have visible labels. Character counts are announced politely (`aria-live="polite"`) only at 280 characters and above, so screen readers are not flooded.
- Similar-question panel: a list of links with clear headings. It updates without moving focus.
- Dialogs: focus trap, Escape to close, return focus to the trigger, default focus on the safe option.
- Status is text, never colour alone. "New" badges and state labels include the words.
- Targets at least 44px. Keyboard order follows visual order.
- Works at A, A+, and A++ without horizontal scrolling at 1024, 1280 and 1440px.
- Reduced motion: no animation for list updates or badges.

---

## 12. Testing

Use the existing harness in `eval/` (see `eval/README.md`).

**Offline (`npm run eval`), add cases in `eval/main.ts`:**

- Question validation: 7 characters rejected, 8 accepted, 300 accepted, 301 rejected, unknown topic rejected, six topics rejected.
- `canMessage` with ages: River → Drop 16 refused; River → Drop 18 allowed; Drop → River allowed; River → River allowed; self refused.
- `publicDisplayName`: "Maya Chen" → "Maya C."; single names; empty names.
- `deriveDropQuestionState`: waiting, in progress (draft only), answered (published), edited modifier.
- Similar-question search: fewer than 15 characters → empty; keyword overlap ranks correctly; never returns `askedBy`.

**E2E (`npm run dev` then `npm run eval:e2e`), add cases in `eval/e2e.mjs`:**

- `PATCH` and `DELETE` return 401 without a session, 403 for another Drop's question, 404 for an unknown id.
- `PATCH` refused (409) once a story is linked. `DELETE` refused (409) once a story is linked.
- `PATCH` re-runs the safety screen: unsafe text is refused and the stored question is unchanged.
- `DELETE` removes the question and its `question-votes.json` entries, and the question no longer appears in browse or search.
- River → Drop under 18 thread creation returns 403 with the generic message. River → Drop 18+ still works. Drop → River still works.
- `GET /api/questions/similar` never includes `askedBy`.

Before running the question-mutation cases, make sure `eval/e2e.mjs` snapshots and restores `data/questions.json` (it currently snapshots `stories.json`, `users.json`, `likes.json`, `chat.json` and `question-votes.json` only). Without it, DELETE and PATCH cases will change seed questions.

**Manual checks (record in the PR):**

- Post a question while typing a near-duplicate of a seed question; confirm the similar panel appears and posting still works.
- Post a question that triggers a soft safety rewrite; confirm the notice and the rewritten text.
- Edit and withdraw a question that has no stories; attempt both on a question with a linked draft; confirm the disabled state explains why.
- Complete the Drop loop with keyboard only, including both dialogs.
- Check public surfaces for full names (must be none) at each text size.
- Log in as a River and open a Drop under 18 (seed `u-drop-…` ages): confirm no "Message" button and a refused request if called directly.
- Run through the seeded unanswered questions (11) to test the waiting state and the answered state.

**Build:** `npm run build` must pass.

---

## 13. Acceptance criteria

- **DA-1** A River cannot start a conversation with a Drop under 18, enforced on the server. The UI never offers the action.
- **DA-2** Public surfaces show a Drop as first name and last initial. No public page shows a Drop's full name.
- **DA-3** Questions are validated on the server for length and topics, and every question goes through the safety screen on create and edit.
- **DA-4** A Drop can see, for every question they asked, whether it is waiting, being answered, or answered, with a next step.
- **DA-5** A Drop can edit a question only while no story is linked to it, and withdraw it only while no story is linked. Both states explain why when disabled.
- **DA-6** Asking shows similar existing questions without blocking posting, and never loses typed text on error.
- **DA-7** No Drop-facing text promises a reply, a notification, or a follow feature.
- **DA-8** The message action reads "Send {first name} a message" and explains that it is private.
- **DA-9** Browsing and asking are separate pages with the same navigation labels everywhere.
- **DA-10** The Drop tour, Help, and rail match the implemented routes.
- **DA-11** All tests in §12 pass and `npm run build` succeeds.

---

## 14. Non-goals

- Notifications, email, push, or any "follow" feature (D9).
- Changing the writing, safety, or accuracy agents' prompts or thresholds.
- Moderation tools, reporting workflow changes, or a moderator dashboard.
- Verifying a Drop's age or identity beyond what onboarding already collects.
- Changing the Drop age range (16–30).
- River-side changes (see `river-experience.md`), except where both plans share the rail or the messaging rule.
- Mobile navigation below 1024px (shared work; see `header-navigation.md`).

---

## 15. Open questions for the product owner

1. **D1:** Is "no adult-initiated contact with Drops under 18" acceptable, or does safety require more (for example, no messaging with minors at all, or moderator review of new threads)?
2. **D2:** Is "first name and last initial" acceptable for public display, or should Drops be able to choose a display name?
3. **D4:** Should a Drop who has a question with a linked draft be able to withdraw it, with the River notified? (Not planned; no notification exists.)
4. **D5:** Should at least one topic be required?
5. Should onboarding show a short privacy note about public names and bios? (Recommended.)

---

## 16. Handover checklist for the implementing agent

- [ ] Read `plan/drop-experience.md`, `plan/river-experience.md` and `plan/header-navigation.md` in full.
- [ ] Confirm §2 against the code; note any difference in the PR description.
- [ ] D1 and D2 confirmed in writing before Phase 0 ships. Phase 5 does not start until D1 is live and tested.
- [ ] No changes to `data/*.json` seed content, to agent prompts, or to safety and accuracy thresholds.
- [ ] New routes documented in `README.md` with auth and error behaviour.
- [ ] Each phase: `npm run build`, `npm run eval`, and the E2E cases added in §12.
- [ ] Summarize changed paths, behaviour, validation performed, and known limitations in the PR.

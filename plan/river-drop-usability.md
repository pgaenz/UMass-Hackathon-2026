# HistorAI usability plan: a clear path from question to lived experience

**Status:** Plan only. Do not treat this document as permission to implement changes without a separate request.

## Goal

Make HistorAI's central value easy to understand and use:

> A young person's real question receives a useful answer grounded in an older adult's lived experience.

A River should be able to find a question, answer in a comfortable way, understand how the answer becomes a story, and knowingly decide whether to publish it. A Drop should be able to ask a question or find an answer without navigating unrelated features first.

The key product loop is:

```text
Drop asks a meaningful question
        ↓
River with relevant experience answers
        ↓
River reviews and approves the story
        ↓
Drop can find the answer to the question
```

AI-assisted writing, podcasts, messages, profiles, votes, and other features should support this loop rather than compete with it on the first screen.

## Product and UX principles

1. **One obvious next step per role.** A River's primary action is to answer a question. A Drop's primary action is to ask a question or learn from existing stories.
2. **Plain language before product language.** Keep “River” and “Drop” as friendly identity terms, but explain them as “older adult who answers questions” and “young person who asks questions.” Use understandable labels such as “Read stories,” not unexplained shorthand.
3. **Show the whole process.** Tell Rivers what happens before they send an answer and before it is published. Do not imply that submitting an answer publishes it.
4. **The River owns the story.** Make clear that AI helps shape the answer into a readable story; it does not replace the River's judgment. A review score is not proof that a story is true.
5. **Personalize the starting point, not the whole product.** Role-specific home pages should prioritize different tasks while preserving a consistent header, design, help, and access to other relevant parts of the site.
6. **Do not make unsupported promises.** Only claim that a draft is private, that audio is deleted, that an asker is notified, or that content is verified if the product's actual behavior and policy guarantee it.
7. **Accessible by default.** Use readable text, clear labels, large controls, keyboard access, responsive layouts, and understandable loading, error, and empty states. Avoid relying on color, icons, animation, or a tutorial alone to communicate meaning.

## Role-specific home pages

The root route (`/`) currently renders a shared `QuestionExplorer`; it already knows whether the current user can answer. Change the *content priority* of the home page by role, not the entire site architecture.

### River home

- Lead with: **“Your experience can help answer someone's question.”**
- Primary action: **“Find a question to answer”** linking to `/senior`.
- Show questions that still need a published answer, with a direct **“Answer this question”** action on each card.
- If there are no unanswered questions, show a useful fallback such as recent questions or a link to browse all questions. Never leave the River at a dead end.
- Explain the short process near the main action: **Answer → Review your story → Choose whether to publish.**
- Keep reading published stories available as a secondary action. Do not make podcasts, messages, or profile features the dominant content.

### Drop home

- Lead with: **“What would you like to learn from someone who's been there?”**
- Primary action: **“Ask a question”** leading to the existing question form on `/questions`.
- Provide a clear secondary route to browse questions and read published stories. A Drop should be able to learn without being required to post first.
- Where existing data supports it, show stories in the context of the questions they answer. Do not imply that a question has a direct response or that a Drop has been notified unless that behavior exists.

### Visitor home

- Use a neutral welcome focused on browsing questions and reading published stories.
- Make the visitor's limits and the option to create a profile clear without blocking reading.

### Shared home behavior

- Keep the visual structure and location of shared navigation consistent for all roles.
- Keep other relevant destinations accessible; personalization must not become a hard wall.
- Home content must reflect the current session role, including returning users. Onboarding already routes to `/`; preserve that flow and ensure the role-aware home renders after the session refreshes.
- Prefer shared question/story components and role-specific compositions over duplicated business logic.

**Likely files:** `app/page.tsx`, `components/question-explorer.tsx`, and reusable question/story card components. The exact component split is an implementation decision; avoid growing `QuestionExplorer` into an unmaintainable role switch if small dedicated home compositions are clearer.

## Navigation and wording

- Rename the primary River navigation label from **“Answer”** to **“Answer a question.”**
- Rename **“Read”** to **“Read stories.”**
- Give the Drop a clear **“Ask a question”** route, while retaining an understandable way to browse existing questions.
- Keep less central destinations (for example Podcasts and, if appropriate to the design, Messages) available but visually secondary. A “More” menu is an option, not a requirement; if introduced, make it keyboard accessible and ensure existing destinations remain discoverable.
- Use visible text labels for important controls where space allows. Do not require a River to recognize a compass or magnifying-glass icon to find Quick links or Search. Help should remain easy to identify.
- Preserve text-size controls, profile access, and sign-out. Keep navigation labels stable across pages so a user can build familiarity.

**Likely file:** `components/site-header.tsx`. The `/questions` route currently combines asking and browsing, while `/senior` is the River answer flow; labels and links must reflect those actual destinations and permissions.

## River answer journey

### 1. Choose a question

- Put a plain instruction at the top of `/senior`: **“Choose a question you have personal experience with.”**
- Make the question itself easy to scan and give each question a clear **“Answer this question”** action.
- Make unanswered questions easy to locate by default or with one clearly named control. Keep topic filters and popularity/newness sorting available, but secondary to the choice of question.
- Explain sorting in plain language; do not rely on labels such as “Trending Today” or “Most Insightful” without explaining their relevance.
- Provide clear empty and fallback states.

**Likely files:** `app/senior/page.tsx`, `components/question-card.tsx`, and any shared question-list component.

### 2. Answer by speaking or typing

- Explain that the River can speak naturally or type. Keep both choices clearly labeled and equally respectful; do not assume every older adult prefers voice.
- Present **“Talk with an interviewer”** as optional help, rather than as a third equally prominent route that might make the basic task seem complicated.
- Before recording, explain that the browser may ask for microphone access, what the River should select, and that a recording can be previewed before it is submitted.
- Keep the existing ability to preview audio and to switch to typing if microphone access fails.
- Use a next-step label such as **“Send answer for review”** rather than the ambiguous **“Submit answer.”** Explain that this starts draft preparation, not publication.
- Show a clear progress message while the transcript/story is prepared. Preserve errors and a recoverable path if generation fails.

**Likely file:** `components/answer-form.tsx`.

### 3. Review and decide

- Present the original answer and the generated story clearly, with the story and decision actions taking priority over internal scores and technical details.
- State plainly that the draft is based on the River's answer and that the River should correct anything that does not sound right.
- Explain checks in ordinary language. In particular, do not describe an AI grounding review as independent proof of truth.
- Make the choices obvious: **“Publish this story”** and **“Ask for a change.”** Keep a clear way to leave without publishing if supported by the existing workflow.
- Preserve the product's existing safety gates. The current workflow may allow publishing after an editor review fails, while safety-blocked stories cannot be published; if that behavior remains, explain the difference in plain language and make **“Publish anyway”** an explicit, informed choice rather than a confusing surprise.
- Make it explicit that publication requires the River's deliberate approval. Do not auto-publish.
- After publication, confirm the result and show where the story can be found and which question it answers. Do not promise a personal notification to the Drop unless one is implemented.

**Likely files:** `app/senior/review/[id]/page.tsx`, `components/review-actions.tsx`, and the existing publish flow. Avoid changing API or server-side safety/publish rules as part of a copy/layout improvement unless separately specified and tested.

## First-time guidance and help

- Shorten the River's first-use tour to the core path: find a question, answer it, review and choose whether to publish.
- Keep optional features out of the required first-use tour. Preserve the ability to skip and replay it.
- Keep Help easy to find and make it a practical fallback, not the only place where essential task instructions live.
- Use the same plain-language terms in the home page, tour, form, review page, and Help FAQ.

**Likely files:** `lib/tutorial-steps.ts`, `components/tutorial/tutorial-provider.tsx`, and `app/help/page.tsx`.

## Suggested implementation order

1. **Confirm current behavior and copy.** Trace the existing role/session and answer-to-publish flows. Agree on exact user-facing terms and do not promise behavior that is not present.
2. **Role-aware home compositions.** Add River, Drop, and visitor priorities while preserving shared navigation and reusable feed components.
3. **Navigation and question discovery.** Clarify labels and make the River's question choice easy to understand without removing useful browse/filter controls.
4. **Answer form guidance.** Clarify voice/type choices, microphone permission, the review step, and progress/error states.
5. **Review and publication clarity.** Simplify the hierarchy, explain AI checks accurately, and make the River's approval decision unmistakable.
6. **Tour, Help, and polish.** Align supporting guidance and verify text scaling, keyboard use, responsive behavior, and reduced-motion behavior.
7. **Usability validation.** Test the core tasks with representative Rivers and Drops before expanding secondary features or adding more onboarding.

## Acceptance criteria

- A signed-in River sees a River-focused home page and can identify the primary next action without first exploring the navigation.
- A signed-in Drop sees a Drop-focused home page with a clear way to ask a question and a clear way to learn from existing stories.
- A visitor sees a neutral browsing experience and can read without being forced to create a profile.
- The shared navigation remains consistent and all previously available destinations remain accessible to users who are permitted to use them.
- A River can identify a question that needs an answer, choose it, and understand how to answer by voice or text.
- A River understands why microphone permission may appear and has a usable text alternative if recording is unavailable.
- Before sending an answer, the River understands that it will be prepared for review and is not published automatically.
- The review page makes it clear what the River is approving, what the review checks mean, and what happens after publication.
- No generated story is published without an explicit River action. Existing server-side authorization, safety gates, and publish rules continue to be enforced.
- Empty, loading, and failure states provide a clear next action rather than a dead end.
- Text-size options, keyboard navigation, focus visibility, and responsive layouts work across the role-specific home pages and core answer flow.

## Usability validation

Test the prototype or implementation with older adults who are not especially comfortable using websites, as well as young people in the Drop role. Give participants tasks without coaching them through the interface:

1. As a River, find a question you could answer.
2. Record or type an answer and explain what happens after sending it.
3. Review the generated story and decide how to proceed.
4. As a Drop, find a story that helps or ask a question.
5. As a visitor, find and read a story without signing in.

Observe where participants pause, misinterpret a label, or worry about sharing. Ask them to explain in their own words whether an answer has been published and who can see it at each stage. Prioritize fixes that improve successful completion and confidence in the question-to-answer loop, not clicks on secondary features.

## Coding guidelines for the implementing agent

1. **Inspect before editing.** Read the current target components, route behavior, relevant types, and session helpers. Treat this plan as direction, not a substitute for checking actual implementation.
2. **Make focused changes.** Implement one phase at a time. Avoid unrelated refactors, new dependencies, broad restyling, or changes to product scope.
3. **Reuse existing patterns.** Reuse question/story cards, buttons, empty states, page headers, and styling conventions where they fit. Extract shared UI only when it genuinely reduces duplication; do not duplicate filtering, permission, or data-fetching logic across persona views.
4. **Respect server/client boundaries.** Fetch role and page data on the server where practical; pass serializable props into client components. Add client state only for real interactions. Avoid putting session secrets or privileged decisions in client code.
5. **Enforce permissions on the server.** Hiding a link or button is not authorization. Preserve server-side role checks, session checks, safety gates, and approval rules for question creation, answering, and publication.
6. **Preserve data and API contracts.** Do not modify seeded JSON data, route payloads, or model behavior to accomplish a presentation change. If a functional change is needed, document it separately and add tests for its behavior.
7. **Use semantic, accessible controls.** Use links for navigation and buttons for actions; provide visible labels, associated form labels, accessible names, keyboard operation, visible focus, and sensible touch targets. Do not make color, emoji, hover, or animation the only indication of meaning or state.
8. **Keep copy consistent and honest.** Prefer short, direct sentences and concrete verbs. Explain “River” and “Drop” where needed. Avoid claims that AI verifies truth, guarantees accuracy, keeps a draft private, deletes audio, or notifies someone unless those claims are verified against actual behavior and policy.
9. **Handle every state.** Provide sensible loading, error, empty, permission-denied, and success states. Make retries and alternatives clear; never silently discard a user's answer or publish it automatically.
10. **Preserve responsive and accessibility behavior.** Test narrow and wide layouts, text-size settings, keyboard navigation, and reduced-motion preferences. Keep decorative effects subordinate to task content.
11. **Do not regress adjacent roles.** Check River, Drop, visitor, signed-out, and returning-user experiences when changing `/`, the header, or shared components. Keep role-specific actions correct while preserving useful shared destinations.
12. **Validate changes.** Run the production build (`npm run build`) and the applicable evaluation checks. The repository documents `npm run eval` and `npm run eval:e2e`; run the E2E suite with a development server as described in `eval/README.md` when changes touch relevant flows. Manually exercise microphone-allowed and microphone-denied paths and the River/Drop/visitor home variants. Report any checks that could not be run.
13. **Keep the change reviewable.** Use clear component names and small diffs. Do not add abstractions just for hypothetical future roles. Summarize changed paths, behavior, validation, and known limitations when implementation is later requested.

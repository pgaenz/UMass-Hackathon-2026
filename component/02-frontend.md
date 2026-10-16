# Frontend Components

**Stack:** Next.js (React), Tailwind CSS, Web Audio API / MediaRecorder, Supabase JS client.
Back to index: [`README.md`](./README.md)

---

### `C-FE-01` App Shell, Routing & Layout

- **Purpose:** Provide the two-route dual-generation shell: `/senior` (Accessibility Mode)
  and `/youth` (Feed Mode).
- **Responsibilities:** Layout, navigation, role-aware redirects, loading/error boundaries,
  route guards.
- **Interfaces:** `/senior`, `/youth`, `/youth/story/[id]`, `/senior/approve/[id]`,
  `/login`, `/onboarding`.
- **Inputs → Outputs:** Auth session + role → correct shell.
- **Dependencies:** `C-AR-03`, `C-FE-08`
- **Tech:** Next.js App Router, Tailwind, shadcn/ui optional.
- **Phase:** P1
- **Acceptance Signals:** Senior account never lands on youth routes and vice versa; deep
  links work; 404/error states handled.
- **Risks / Open Questions:** Single app vs. two builds; how role switching is prevented.

---

### `C-FE-02` Senior "Zero-Friction Storyteller Mode" UI

- **Purpose:** Let a senior answer the week's question with one tap, no tech skill required.
- **Responsibilities:** Prominent prompt card ("Question from Leo (20): …"), giant pulsing
  Record/Stop button, optional typed answer, approve-and-publish control, status of the
  AI pipeline.
- **Interfaces:** Prompt fetch, record control, upload progress, approval action.
- **Inputs → Outputs:** Assigned prompt → recorded audio / text; generated media → 1-tap approve.
- **Dependencies:** `C-FE-01`, `C-FE-03`
- **Tech:** React, Tailwind, large-type/high-contrast tokens from `C-FE-07`.
- **Phase:** P2
- **Acceptance Signals:** A first-time user can record and submit without instruction;
  state feedback is always visible; approval is a single tap.
- **Risks / Open Questions:** Accidental double-records; microphone permission denial UX.

---

### `C-FE-03` Voice Recording & Browser Media Capture

- **Purpose:** Capture high-quality senior audio in-browser and deliver it to the backend.
- **Responsibilities:** `MediaRecorder`/Web Audio setup, permission handling, live level
  meter, max-duration guard, pause/resume, upload with retry, raw blob storage handoff.
- **Interfaces:** `start()`, `stop()`, `onData(blob)`, upload to `C-BE-03`.
- **Inputs → Outputs:** Microphone stream → audio blob → stored raw asset.
- **Dependencies:** `C-FE-01`, `C-BE-03`
- **Tech:** MediaRecorder API, Web Audio API, `getUserMedia`.
- **Phase:** P2
- **Acceptance Signals:** 60s+ recording uploads successfully; works in Chrome/Safari;
  clear recovery if permission denied.
- **Risks / Open Questions:** Browser codec differences (webm/opus vs mp4); HTTPS requirement.

---

### `C-FE-04` Youth "Wisdom Hub" Media Feed

- **Purpose:** Let young users browse categorized senior wisdom and discover stories.
- **Responsibilities:** Category filter tabs (`#HistoricalEvents`, `#CareerWisdom`,
  `#Relationships`, `#LifeLessons`), story card list, search, empty/held states, pagination.
- **Interfaces:** Feed query, story detail route, category filters.
- **Inputs → Outputs:** Published stories → browsable, filterable cards.
- **Dependencies:** `C-FE-01`, `C-BE-04`
- **Tech:** React Server Components/Next data fetching, Tailwind.
- **Phase:** P3
- **Acceptance Signals:** Only approved+published media appears; filters return correct
  subsets; held/unapproved content never leaks.
- **Risks / Open Questions:** Cold-start content; ranking/discovery algorithm deferred.

---

### `C-FE-05` Tri-Modal Media Player

- **Purpose:** Present the same story as Article, Podcast and Video without leaving the page.
- **Responsibilities:** Tab switcher, rendered Markdown article, custom HTML5 audio player
  with episode art, embedded 9:16 vertical video/audiogram, graceful fallback when one
  format is missing.
- **Interfaces:** `media_outputs` by type; format tabs.
- **Inputs → Outputs:** Story + 3 media URLs → playable/readable experience.
- **Dependencies:** `C-FE-04`, `C-MEDIA-02/03/04`
- **Tech:** `react-markdown`, `<audio>`, `<video>`, Tailwind.
- **Phase:** P3
- **Acceptance Signals:** All three tabs play/render on desktop and mobile; missing format
  shows a clear fallback, not a broken player.
- **Risks / Open Questions:** Mobile audio autoplay policies; video hosting bandwidth.

---

### `C-FE-06` Connection & Penpal Chat UI

- **Purpose:** Convert passive consumption into a safe 1-on-1 relationship.
- **Responsibilities:** "Ask a Follow-Up" input, AI-suggested icebreakers, shared-interest
  match badge (e.g. "92% Match — 3 shared interests"), chat drawer, blocked-message error
  banner with real-time feedback.
- **Interfaces:** Chat send/receive (`C-BE-06`), match suggestions (`C-AG-08`).
- **Inputs → Outputs:** Reader intent → follow-up / penpal request → moderated chat thread.
- **Dependencies:** `C-FE-04`, `C-BE-06`
- **Tech:** React, Supabase Realtime optional, Tailwind.
- **Phase:** P4
- **Acceptance Signals:** Blocked messages show the reason and never reach the recipient;
  successful messages persist; escalation link is reachable.
- **Risks / Open Questions:** Moderation latency UX; whether chat is realtime or polling in MVP.

---

### `C-FE-07` Design System, Accessibility & i18n

- **Purpose:** Guarantee senior-friendly accessibility and a consistent visual language.
- **Responsibilities:** Type scale, high-contrast palette, focus states, touch-target sizes,
  ARIA, keyboard nav, reduced-motion, i18n scaffolding (future cross-lingual AI dubbing).
- **Interfaces:** Shared tokens + primitive components.
- **Inputs → Outputs:** Design tokens → themed, accessible components.
- **Dependencies:** `C-FE-01`
- **Tech:** Tailwind config, design tokens, `next-intl` optional.
- **Phase:** P1
- **Acceptance Signals:** WCAG AA contrast; senior UI fully keyboard/AT navigable; no reliance
  on color alone.
- **Risks / Open Questions:** Scope creep; balancing youth aesthetic vs. senior accessibility.

---

### `C-FE-08` Auth, Roles & Onboarding

- **Purpose:** Authenticate users and route them to the correct experience with the right
  permissions.
- **Responsibilities:** Supabase Auth (email/magic link), role selection (`senior` /
  `youth` / `institution`), 3-question onboarding quiz to seed interests, consent capture,
  session management.
- **Interfaces:** Login, signup, role assignment, onboarding quiz, consent record.
- **Inputs → Outputs:** Credentials → session + role + interest profile.
- **Dependencies:** `C-DATA-02`
- **Tech:** Supabase Auth, Next.js middleware.
- **Phase:** P1
- **Acceptance Signals:** Role correct after signup; consent stored; interest profile drives
  matching; unauthenticated users cannot access either dashboard.
- **Risks / Open Questions:** Friction for seniors; password reset support; minors (16–17)
  consent handling.

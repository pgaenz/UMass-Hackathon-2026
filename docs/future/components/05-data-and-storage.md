# Data & Storage Components

**Platform:** Supabase (Postgres, Auth, Storage, Realtime, RLS).
Back to index: [`README.md`](./README.md)

---

### `C-DATA-01` Postgres Schema

- **Purpose:** Persist every core product entity with integrity and auditability.
- **Core tables:**
  - `users` — id, role, name, age_band, interests[], bio, created_at
  - `prompts` — id, youth_id, raw_question, refined_question, topic_tags[], status,
    assigned_senior_id, created_at
  - `stories` — id, prompt_id, senior_id, raw_audio_path, transcript, word_timestamps,
    metadata (topic, tone, key_events, quotes), visibility, status, created_at
  - `media_outputs` — id, story_id, type (article|podcast|video), content/path, grounding_score,
    pii_detected, review_status, published_at
  - `messages` — id, thread_id, sender_id, body, safety_verdict, created_at
  - `threads` / `connections` — participant ids, match_score, shared_interests, consent flags
- **Responsibilities:** Migrations, constraints, indexes for feed/matching, foreign keys.
- **Inputs → Outputs:** Domain writes → consistent rows + referential integrity.
- **Dependencies:** `C-AR-03`
- **Tech:** SQL migrations (Supabase CLI), Postgres.
- **Phase:** P1
- **Acceptance Signals:** All five mandatory tables exist with FKs; migrations replay cleanly;
  indexes support feed and matching queries.
- **Risks / Open Questions:** JSONB vs. normalized metadata; schema churn during hackathon.

---

### `C-DATA-02` Supabase Auth & Role Model

- **Purpose:** Identity + authorization for seniors, youth and institutions.
- **Responsibilities:** Sign-up/login, JWT claims with role, session refresh, admin/institution
  scopes, profile row sync via trigger.
- **Inputs → Outputs:** Credentials → authenticated session + role claim.
- **Dependencies:** `C-DATA-01`
- **Tech:** Supabase Auth (email/magic link), Postgres triggers.
- **Phase:** P1
- **Acceptance Signals:** Role present in JWT and enforced server-side; profile auto-created;
  passwordless flow works for seniors.
- **Risks / Open Questions:** Email dependency for seniors; institution multi-seat access.

---

### `C-DATA-03` Storage Buckets

- **Purpose:** Store raw and processed media with correct access rules.
- **Responsibilities:** Buckets `raw-audio`, `processed-audio`, `video-reels`; signed URLs
  for private assets; lifecycle/cleanup; content-type enforcement.
- **Inputs → Outputs:** Uploads → durable objects + signed playback URLs.
- **Dependencies:** `C-DATA-01`
- **Tech:** Supabase Storage, signed URL policies.
- **Phase:** P1
- **Acceptance Signals:** Raw audio private by default; processed media only reachable via
  signed URL or published flag; no public bucket leaks.
- **Risks / Open Questions:** Bucket size limits; cost of video storage for demo.

---

### `C-DATA-04` Row-Level Security, Visibility & Consent Model

- **Purpose:** Enforce that users only ever see what they are entitled to.
- **Responsibilities:** RLS policies per table; visibility levels (Public, Youth-Community
  Only, Private Family Only); consent records for stories and connections; soft-delete and
  revocation semantics.
- **Inputs → Outputs:** User JWT + resource policy → allowed/denied rows.
- **Dependencies:** `C-DATA-01`, `C-DATA-02`
- **Tech:** Postgres RLS policies, service-role server writes.
- **Phase:** P1 (base) → P4 (consent/visibility)
- **Acceptance Signals:** A youth cannot read another youth's private thread; a
  private-family story is invisible in the public feed; revocation hides content immediately.
- **Risks / Open Questions:** RLS complexity/bugs; keeping policies in sync with app logic.

---

### `C-DATA-05` Evaluation, Moderation & Audit Logs

- **Purpose:** Make trust metrics and every safety decision measurable and auditable.
- **Responsibilities:** Tables/events for `moderation_events`, `review_verdicts`,
  `publication_events`, `evaluation_cases`, `agent_runs` (latency, tokens, cost, outcome);
  retention policy.
- **Inputs → Outputs:** Agent/gate events → queryable metrics for `C-TRUST-09`.
- **Dependencies:** `C-DATA-01`, `C-TRUST-09`
- **Tech:** Postgres tables + append-only logging helper.
- **Phase:** P4
- **Acceptance Signals:** Time-to-Verdict, interception detection rate, grounding scores and
  pipeline latency can all be queried; every publication has a linked review event.
- **Risks / Open Questions:** PII in logs; log volume; redaction of stored transcripts.

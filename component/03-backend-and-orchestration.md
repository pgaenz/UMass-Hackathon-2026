# Backend & Orchestration Components

**Stack:** Python 3.11+, FastAPI, Pydantic, Supabase (Postgres/Auth/Storage), background jobs.
Back to index: [`README.md`](./README.md)

---

### `C-BE-01` FastAPI Application & API Gateway

- **Purpose:** Single typed entry point for all frontend and agent traffic.
- **Responsibilities:** Routing, request validation, auth middleware, rate limiting, error
  envelope, CORS, OpenAPI docs, idempotency keys for uploads/generation.
- **Interfaces:** `/api/voice-input`, `/api/prompts/*`, `/api/stories/*`, `/api/media/*`,
  `/api/chat/send`, `/api/review/*`, `/api/health`.
- **Inputs → Outputs:** HTTP requests → validated service calls → typed JSON responses.
- **Dependencies:** `C-AR-03`, `C-DATA-01`, `C-BE-08`
- **Tech:** FastAPI, Pydantic v2, Uvicorn, python-jose/Supabase JWT verification.
- **Phase:** P1
- **Acceptance Signals:** OpenAPI spec covers every endpoint; auth enforced; consistent error
  shape; health check green.
- **Risks / Open Questions:** File upload size limits; streaming vs. buffered audio upload.

---

### `C-BE-02` Prompt & Matching Service

- **Purpose:** Capture youth questions, refine them, and route to the best-suited senior.
- **Responsibilities:** Prompt CRUD, AI refinement (`C-AG-01`), topic tagging, senior
  profile/expertise matching, prompt queue per senior, "Question of the Week" selection.
- **Interfaces:** `POST /api/prompts`, `GET /api/prompts/assigned`, matching result payload.
- **Inputs → Outputs:** Youth question + senior profiles → refined prompt + assignment.
- **Dependencies:** `C-BE-01`, `C-AG-01`
- **Tech:** FastAPI service, Postgres matching query, embeddings optional.
- **Phase:** P2
- **Acceptance Signals:** Every senior gets at most N open prompts; a question routes to a
  senior with matching interests; refinement preserves the youth's intent.
- **Risks / Open Questions:** Cold-start matching with sparse profiles; fairness/coverage.

---

### `C-BE-03` Voice Input Endpoint

- **Purpose:** Accept senior audio/text, store it safely, and kick off transcription.
- **Responsibilities:** Multipart upload, MIME/size validation, store to `raw-audio` bucket,
  create `story` row, enqueue `C-AG-02`, return job/story id.
- **Interfaces:** `POST /api/voice-input` (audio | text), status polling endpoint.
- **Inputs → Outputs:** Audio blob + prompt id → stored story + transcript job.
- **Dependencies:** `C-BE-01`, `C-AG-02`, `C-DATA-03`
- **Tech:** FastAPI `UploadFile`, Supabase Storage SDK.
- **Phase:** P2
- **Acceptance Signals:** Upload succeeds for 5-min audio; story linked to prompt + senior;
  failure returns actionable error; no orphan files.
- **Risks / Open Questions:** Large-file memory use; retry/duplicate detection.

---

### `C-BE-04` Tri-Modal Generation Orchestrator

- **Purpose:** Turn an approved transcript into Article, Podcast and Video outputs.
- **Responsibilities:** Invoke `C-AG-09`, fan out to creator agents, track per-format status,
  aggregate results, persist `media_outputs`, notify frontend.
- **Interfaces:** `POST /api/stories/{id}/generate`, `GET /api/stories/{id}/status`.
- **Inputs → Outputs:** Transcript + metadata → 3 media records (+ audio/video files).
- **Dependencies:** `C-BE-01`, `C-AG-09`
- **Tech:** FastAPI + async jobs (`C-BE-07`).
- **Phase:** P3
- **Acceptance Signals:** One call yields all 3 formats within the KPI budget; partial failure
  is tolerated and surfaced; reruns are idempotent.
- **Risks / Open Questions:** External API rate limits; cost per generation.

---

### `C-BE-05` Review → Approval → Publication State Machine

- **Purpose:** Guarantee nothing is published without automated review and senior consent.
- **Responsibilities:** Story lifecycle states (`transcribed → generated → under_review →
  auto_approved | held → pending_senior → published | rejected`), enforce gates, persist
  reviewer scores, trigger publication block.
- **Interfaces:** `POST /api/review/{story_id}`, `POST /api/stories/{id}/approve`,
  publication guard middleware.
- **Inputs → Outputs:** Generated media + reviewer verdict + senior consent → published/held.
- **Dependencies:** `C-BE-01`, `C-AG-06`, `C-TRUST-03`, `C-TRUST-06`
- **Tech:** Explicit FSM in Python; DB status column with constraints.
- **Phase:** P4
- **Acceptance Signals:** No `published` row can exist without reviewer pass + senior
  approval; invalid transitions rejected; every transition audited.
- **Risks / Open Questions:** Auto-approve threshold tuning; "held" recovery path UX.

---

### `C-BE-06` Chat / Safety Send Endpoint

- **Purpose:** Mediate all 1-on-1 youth↔senior messages through the safety shield.
- **Responsibilities:** Receive message, synchronously call `C-AG-07`, hard-block on
  unsafe verdict, persist only allowed messages, return block reason, trigger escalation
  for crisis content.
- **Interfaces:** `POST /api/chat/send`, `GET /api/chat/thread/{id}`.
- **Inputs → Outputs:** Message text → allowed (stored) | blocked (reason) | escalated.
- **Dependencies:** `C-BE-01`, `C-AG-07`
- **Tech:** FastAPI, OpenAI Moderation, regex scanner.
- **Phase:** P4
- **Acceptance Signals:** Scam/PII/abuse messages are never written to the recipient thread;
  Time-to-Verdict measured and logged; crisis content routed to `C-TRUST-07`.
- **Risks / Open Questions:** False positives blocking legitimate family talk; sync latency.

---

### `C-BE-07` Background Job Queue & Scheduler

- **Purpose:** Run slow agent/media work off the request path and on a schedule.
- **Responsibilities:** Job queue, workers, retries/backoff, dead-letter, scheduled weekly
  prompt distribution, timeout enforcement.
- **Interfaces:** Enqueue/dequeue API, worker process, schedule config.
- **Inputs → Outputs:** Job payload → processed result / failure event.
- **Dependencies:** `C-AR-02`
- **Tech:** FastAPI BackgroundTasks (MVP) or Celery/RQ + Redis; cron via scheduler.
- **Phase:** P1 (skeleton) → P3
- **Acceptance Signals:** Recording upload returns immediately; pipeline completes async;
  scheduled prompt distribution fires; failed jobs are retryable and observable.
- **Risks / Open Questions:** Extra infra cost; hackathon simplicity vs. reliability.

---

### `C-BE-08` Data Access Layer & Repositories

- **Purpose:** Centralize all DB/storage access behind typed repositories.
- **Responsibilities:** CRUD for users, prompts, stories, media_outputs, messages, reviews;
  transaction boundaries; soft deletes; query helpers for feed and matching.
- **Interfaces:** Repository classes / Pydantic models per entity.
- **Inputs → Outputs:** Domain calls → typed rows; enforces RLS-friendly queries.
- **Dependencies:** `C-DATA-01`
- **Tech:** Supabase Python client / SQLAlchemy, Pydantic.
- **Phase:** P1
- **Acceptance Signals:** No raw SQL outside repositories; all reads respect user scope;
  unit-testable with mocked client.
- **Risks / Open Questions:** Supabase client vs. direct Postgres driver.

---

### `C-BE-09` Shared Types & Data Contracts

- **Purpose:** Single definition of every payload crossing service/agent boundaries.
- **Responsibilities:** Request/response schemas, agent I/O schemas, enums for statuses,
  categories, media types, safety verdicts; mirror TS types for the frontend.
- **Interfaces:** Pydantic models + generated TypeScript types.
- **Inputs → Outputs:** Schema changes → synchronized backend/frontend types.
- **Dependencies:** `C-DATA-01`
- **Tech:** Pydantic, `openapi-typescript` or hand-maintained `/packages/shared`.
- **Phase:** P1
- **Acceptance Signals:** One change point per contract; CI flags drift; no `any` on API
  responses in the frontend.
- **Risks / Open Questions:** Codegen friction during a hackathon; may hand-sync.

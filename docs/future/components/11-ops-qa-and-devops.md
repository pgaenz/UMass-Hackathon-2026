# Ops, QA & DevOps Components

Back to index: [`README.md`](./README.md)

---

### `C-OPS-01` Config & Secrets Management

- **Purpose:** Keep API keys and config out of code and safe for the demo.
- **Responsibilities:** `.env.example` with every variable, secret loading, rotation notes,
  per-environment keys, never commit real secrets, fail-fast on missing config.
- **Variables:** `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `CREATOMATE_API_KEY`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENV`.
- **Dependencies:** `C-AR-04`
- **Phase:** P1
- **Acceptance Signals:** App refuses to boot without required vars; no secret in git history;
  `.env.example` is complete.
- **Risks / Open Questions:** Hackathon key sharing; leaked keys in screenshots.

---

### `C-OPS-02` Local Dev & Docker Compose

- **Purpose:** One command brings the whole stack up for either developer.
- **Responsibilities:** Compose file for web + api (+ redis/worker if used), seed script,
  Makefile/task runner, hot reload.
- **Dependencies:** `C-AR-03`
- **Phase:** P1
- **Acceptance Signals:** `make dev` (or `docker compose up`) starts a working stack; seed
  data creates a ready demo.
- **Risks / Open Questions:** Supabase is cloud-hosted → local needs env, not a container.

---

### `C-OPS-03` CI/CD Pipeline

- **Purpose:** Catch breakage before the demo and enable quick deploys.
- **Responsibilities:** Lint, typecheck, unit tests, build on PR; deploy web + api on merge to
  main; secrets injected via CI.
- **Dependencies:** `C-OPS-02`
- **Phase:** P1 (basic) → P5 (final)
- **Acceptance Signals:** PRs blocked on red checks; main auto-deploys to the demo env.
- **Risks / Open Questions:** CI time budget; Python+Node in one pipeline.

---

### `C-OPS-04` Observability, Logging & Metrics

- **Purpose:** See what the agents are doing and prove the KPIs.
- **Responsibilities:** Structured logs per agent run, pipeline latency, token/cost, review
  verdicts, safety Time-to-Verdict, error rates; simple dashboard or log table.
- **Dependencies:** `C-AR-02`, `C-DATA-05`
- **Phase:** P3/P4
- **Acceptance Signals:** Can answer "how long did generation take" and "how many scams were
  blocked" from logs/dashboards.
- **Risks / Open Questions:** Not logging PII; keeping it lightweight.

---

### `C-OPS-05` Test Suite

- **Purpose:** Prove the golden path and the guardrails actually work.
- **Responsibilities:** Unit (repos, policy thresholds, PII regex), integration (endpoint →
  agent with mocks), e2e (record → publish → feed), safety regression suite.
- **Dependencies:** `C-AR-03`
- **Phase:** P5
- **Acceptance Signals:** CI runs tests green; guardrail tests fail if a control is removed;
  e2e uses mocked external APIs for determinism.
- **Risks / Open Questions:** Mocking cost; keeping e2e stable.

---

### `C-OPS-06` Mock Data & Demo Fallback Safety Net

- **Purpose:** Guarantee a zero-glitch pitch even if a live API or network fails.
- **Responsibilities:** Pre-seeded/approved story with all 3 media formats, pre-rendered
  audio/video assets, recorded scam-block transcript, feature flag to switch live↔fallback.
- **Dependencies:** `C-DATA-01`, `C-OPS-02`
- **Phase:** P5
- **Acceptance Signals:** An `offline` flag serves a complete demo without any external call;
  fallback assets are committed/uploaded and tested.
- **Risks / Open Questions:** Fallback diverging from live behavior; storage of demo assets.

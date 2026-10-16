# Architecture & Stack Components

Back to index: [`README.md`](./README.md)

---

### `C-AR-01` System Architecture & Multi-Agent Pipeline

- **Purpose:** Define the end-to-end topology that turns a youth prompt + senior voice memo
  into three polished media formats and a real human connection.
- **Responsibilities:** Own the box diagram, trust boundaries, and the mapping of the four
  workflow steps (Ask & Match → Speak Naturally → Filter & Produce → Connect & Befriend)
  to concrete services and agents.
- **Interfaces:** Block diagrams (Mermaid), sequence diagrams for the golden path, component
  dependency contracts.
- **Inputs → Outputs:** Product requirements → architecture spec + ADRs.
- **Dependencies:** —
- **Tech:** Next.js, FastAPI, Supabase, OpenAI, ElevenLabs, ffmpeg/Creatomate.
- **Phase:** P1
- **Acceptance Signals:** Diagram shows every agent, datastore, external API and trust gate;
  no orphan components; each arrow has an interface owner.
- **Risks / Open Questions:** Async media jobs vs. `<60s` KPI; where orchestration lives
  (FastAPI vs. Supabase edge functions); sync vs. event-driven trade-off.

---

### `C-AR-02` Event-Driven Workflow Orchestration

- **Purpose:** Coordinate multi-step, long-running pipelines without blocking user requests.
- **Responsibilities:** Job lifecycle (queued → running → succeeded/failed/held), retries,
  idempotency, state transitions, human-in-the-loop checkpoints, dead-letter handling.
- **Interfaces:** Job enqueue API, pipeline run state, status webhooks/SSE to frontend.
- **Inputs → Outputs:** `story.created` event → per-agent jobs → `media.ready` /
  `media.held` events.
- **Dependencies:** `C-AR-01`, `C-BE-07`
- **Tech:** FastAPI background tasks / Celery / RQ / Supabase queue; Redis optional.
- **Phase:** P1 (skeleton) → P3 (full pipeline)
- **Acceptance Signals:** A single recording triggers 3 parallel/sequential agent jobs;
  state is queryable; failed jobs retry and surface a held state, never a silent drop.
- **Risks / Open Questions:** Hackathon simplicity vs. production robustness; timeout budget
  for `<60s` end-to-end.

---

### `C-AR-03` Tech Stack, Repo & Module Layout

- **Purpose:** Fix the monorepo structure and the exact libraries so both developers can
  work in parallel without merge chaos.
- **Responsibilities:** Folder conventions, package boundaries, shared types, lint/format
  rules, naming standards, branch strategy.
- **Interfaces:** Directory tree, package manifests, shared type package.
- **Inputs → Outputs:** Chosen stack → scaffolded repo both devs can run.
- **Dependencies:** `C-AR-01`
- **Tech:** `/apps/web` (Next.js + Tailwind), `/apps/api` (FastAPI), `/packages/shared`,
  `/infra`, `/component`, `/plan`.
- **Phase:** P1
- **Acceptance Signals:** `pnpm dev` + `uvicorn` run cleanly; lint/typecheck pass; shared
  contracts import on both sides.
- **Risks / Open Questions:** Python/TS type duplication; whether to use Turborepo.

---

### `C-AR-04` Environment Topology (Local / Staging / Prod)

- **Purpose:** Keep demo, development and any deployed environment isolated and reproducible.
- **Responsibilities:** Define envs, variable names, Supabase projects, storage buckets,
  API keys, and promotion flow.
- **Interfaces:** `.env.example`, infra config, deployment targets.
- **Inputs → Outputs:** Secrets + config → runnable environment matrix.
- **Dependencies:** `C-AR-03`, `C-OPS-01`
- **Tech:** Vercel (web), Fly.io/Render (API), Supabase cloud, Docker Compose (local).
- **Phase:** P1
- **Acceptance Signals:** Fresh clone can run locally from `.env.example`; demo env pinned
  and isolated from dev data.
- **Risks / Open Questions:** Hackathon time budget; no production hardening required but
  demo must never break live.

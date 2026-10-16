# HistorAI — Plan Tracker

This folder turns the `/component` outline into **executable plans with To-Dos and
acceptance criteria**. Every plan is traceable to one or more component IDs.

> **Status: scaffolded.** The full plan index exists below. Detailed plan files are created
> one at a time as we work through them together, in dependency order.

---

## 1. How to use this folder

1. Pick the next plan from the **Execution order** in `ROADMAP.md`.
2. Create/read its file: `/plan/<plan-id>-<slug>.md` using `PLAN_TEMPLATE.md`.
3. Work the To-Dos; check them off as they complete.
4. A plan is **done** only when **all acceptance criteria** pass and are evidenced.
5. Update the **Status** column in the index below.

### Status legend

| Symbol | Status | Meaning |
|--------|--------|---------|
| ⬜ | not started | No work begun |
| 🟡 | in progress | Active work |
| ⛔ | blocked | Waiting on a dependency or decision |
| 🔵 | in review | Work done, acceptance not yet verified |
| ✅ | done | Acceptance criteria all pass with evidence |
| ➖ | deferred | Out of MVP scope (documented, not built) |

### Owners (from the 1-week plan)

| Owner | Focus | Budget |
|-------|-------|--------|
| **Dev A** | Backend, multi-agent pipeline & AI APIs | 15 h |
| **Dev B** | Frontend Next.js, dual UI & media player | 15 h |
| **Both** | Integration, testing, demo, business artifacts | shared |
| **Business** | Market/competition/deck deliverables | shared |

---

## 2. Plan index

### Track 0 — Setup & Foundation

| ID | Plan | Phase | Components | Owner | Status |
|----|------|-------|------------|-------|--------|
| [`P-000`](./P-000-repo-scaffold-envs-ci.md) | Repo scaffold, envs, secrets & CI | P1 | C-AR-03, C-AR-04, C-OPS-01/02/03 | Both | 🟡 |
| `P-001` | Supabase data foundation (schema, auth, buckets, RLS) | P1 | C-DATA-01/02/03/04, C-BE-08/09, C-AG-10 | Dev A | ⬜ |
| `P-002` | Dual-UI app shell, design system & auth/onboarding | P1 | C-FE-01/07/08 | Dev B | ⬜ |

### Track 1 — Voice Input & Transcription

| ID | Plan | Phase | Components | Owner | Status |
|----|------|-------|------------|-------|--------|
| `P-010` | Senior Zero-Friction recording UI | P2 | C-FE-02, C-FE-03 | Dev B | ⬜ |
| `P-011` | Voice input API, storage & story creation | P2 | C-BE-03, C-MEDIA-01, C-DATA-03 | Dev A | ⬜ |
| `P-012` | Whisper transcription & metadata extraction | P2 | C-AG-02, C-INT-02 | Dev A | ⬜ |
| `P-013` | Prompt refinement, tagging & senior matching | P2 | C-BE-02, C-AG-01, C-INT-01 | Dev A | ⬜ |

### Track 2 — Tri-Modal Generation Engine

| ID | Plan | Phase | Components | Owner | Status |
|----|------|-------|------------|-------|--------|
| `P-020` | Agent orchestrator & background jobs | P3 | C-AG-09, C-BE-04/07, C-AR-02 | Dev A | ⬜ |
| `P-021` | Article Agent & article rendering | P3 | C-AG-03, C-MEDIA-04 | Dev A | ⬜ |
| `P-022` | Podcast Agent & audio stitching | P3 | C-AG-04, C-MEDIA-02, C-INT-05 | Dev A | ⬜ |
| `P-023` | Video Agent & reel/audiogram render | P3 | C-AG-05, C-MEDIA-03, C-INT-06 | Dev A | ⬜ |
| `P-024` | Youth Wisdom Hub feed & tri-modal player | P3 | C-FE-04, C-FE-05 | Dev B | ⬜ |

### Track 3 — Guardrails, Safety & Connection

| ID | Plan | Phase | Components | Owner | Status |
|----|------|-------|------------|-------|--------|
| `P-030` | Reviewer & extractive grounding guardrail | P4 | C-AG-06, C-TRUST-01/02, C-INT-01 | Dev A | ⬜ |
| `P-031` | Approval & publication state machine + consent | P4 | C-BE-05, C-TRUST-03/06/08, C-DATA-04 | Dev A/B | ⬜ |
| `P-032` | Safety moderation, PII shield & chat endpoint | P4 | C-AG-07, C-BE-06, C-TRUST-04/05, C-FE-06, C-INT-03 | Dev A/B | ⬜ |
| `P-033` | Crisis escalation & helpline routing | P4 | C-TRUST-07 | Dev A | ⬜ |
| `P-034` | Connection & penpal matching agent | P4 | C-AG-08, C-FE-06 | Dev A/B | ⬜ |

### Track 4 — Integration, Evaluation & Demo

| ID | Plan | Phase | Components | Owner | Status |
|----|------|-------|------------|-------|--------|
| `P-040` | Observability, logging & KPI metrics | P3/P4 | C-OPS-04, C-DATA-05 | Dev A | ⬜ |
| `P-041` | Automated test suite (unit/integration/e2e) | P5 | C-OPS-05 | Both | ⬜ |
| `P-042` | Trust & robustness evaluation harness + matrix | P5 | C-TRUST-09, C-DEL-03 | Dev A | ⬜ |
| `P-043` | Mock data & demo fallback safety net | P5 | C-OPS-06, C-DEL-02 | Both | ⬜ |
| `P-044` | End-to-end demo script & dry runs | P5 | C-DEL-02 | Both | ⬜ |
| `P-045` | Repo packaging, README & runnability | P5 | C-DEL-01 | Both | ⬜ |

### Track 5 — Business & Pitch Deliverables

| ID | Plan | Phase | Components | Owner | Status |
|----|------|-------|------------|-------|--------|
| `P-050` | Problem & research evidence base | B | C-BIZ-01 | Business | ⬜ |
| `P-051` | Market sizing (TAM/SAM/SOM) model | B | C-BIZ-02 | Business | ⬜ |
| `P-052` | Competitive analysis & positioning | B | C-BIZ-03 | Business | ⬜ |
| `P-053` | Freemium model & unit economics | B | C-BIZ-04 | Business | ⬜ |
| `P-054` | GTM & Crossing-the-Chasm roadmap | B | C-BIZ-05 | Business | ⬜ |
| `P-055` | 11-slide pitch deck & speaker scripts | B | C-DEL-04 | Business | ⬜ |
| `P-056` | Responsible AI governance narrative | B | C-DEL-05 | Business | ⬜ |
| `P-057` | Validation survey & customer discovery | B | C-DEL-06 | Business | ⬜ |

### Track 6 — Deferred / Out of MVP scope (documented)

| ID | Plan | Phase | Components | Owner | Status |
|----|------|-------|------------|-------|--------|
| `P-090` | Real-time two-way voice loop (Realtime/TTS) | P4+ | C-INT-04 | Dev A | ➖ |
| `P-091` | Multilingual AI dubbing & translation | Future | C-FE-07 (i18n) | — | ➖ |
| `P-092` | Legacy anthology PDF export | Future | C-MEDIA-04 | — | ➖ |
| `P-093` | Institution/B2B admin portal | Future | C-DATA-02 | — | ➖ |

---

## 3. Traceability rule

- Every plan lists the **component IDs** it delivers.
- Every component in `/component` must appear in **at least one** plan (or be explicitly
  deferred). The deferred list covers the gaps on purpose.
- Acceptance criteria are written so they can be checked by a human or a test.

## 4. Definition of Done (global)

A plan is Done when:
1. All To-Dos are checked.
2. All acceptance criteria pass and evidence is linked (screenshot, test, log, metric).
3. The relevant component entry's **Phase/Acceptance Signals** are satisfied.
4. The index status is updated, and no dependent plan is left blocked.

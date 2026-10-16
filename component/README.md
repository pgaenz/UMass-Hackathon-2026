# HistorAI — MVP Component Outline

> The **full 73-component vision is archived** in [`../docs/future/components/`](../docs/future/components/).
> This file lists only what the MVP actually maintains.

Component IDs are kept from the original outline so future work stays traceable. Everything
not listed under "Kept" is deferred.

---

## Kept components (16)

### Frontend

| ID | Component | Purpose / MVP shape | Phase |
|----|-----------|---------------------|-------|
| `C-FE-01` | App shell & routes | `/senior` and `/youth`; no auth; role chosen by route | P1 |
| `C-FE-02` | Senior input & review UI | Big prompt card, record button, text box, article preview, approve button | P2 |
| `C-FE-03` | Browser voice recording | `MediaRecorder`, stop→upload, permission/error handling | P2 |
| `C-FE-04` | Youth feed & article view | List of approved stories, open one, render Markdown/HTML | P3 |
| `C-FE-07` | Accessibility basics | Large type, high contrast, clear focus — minimal, not a full design system | P1 |

### Backend (Next.js route handlers)

| ID | Component | Purpose / MVP shape | Phase |
|----|-----------|---------------------|-------|
| `C-BE-01` | API routes | `/api/intake`, `/api/generate`, `/api/approve`, `/api/stories` | P1 |
| `C-BE-03` | Story intake | Accept audio or text, save raw file, create story record | P2 |
| `C-BE-05` | Approve / publish flag | Tiny state: `draft → reviewed → published` | P3 |

### Agents / AI

| ID | Component | Purpose / MVP shape | Phase |
|----|-----------|---------------------|-------|
| `C-AG-02` | Transcription & metadata | Whisper → transcript + topic/tone/summary | P2 |
| `C-AG-03` | Article generation | GPT → short extractive article from transcript | P3 |
| `C-AG-06` | Grounding review | GPT → `grounding_score` (1–5) + `pii_detected` + verdict | P3 |

### Integrations

| ID | Component | Purpose / MVP shape | Phase |
|----|-----------|---------------------|-------|
| `C-INT-01` | OpenAI GPT | One shared client for article + review | P2 |
| `C-INT-02` | OpenAI Whisper | Transcription with timestamps | P2 |

### Data & Ops

| ID | Component | Purpose / MVP shape | Phase |
|----|-----------|---------------------|-------|
| `C-DATA-01` | JSON store | `data/stories.json` read/write helpers; no DB | P1 |
| `C-OPS-01` | Config & secrets | `.env.local` + `.env.example`, fail fast on missing key | P1 |
| `C-OPS-06` | Mock fallback | Pre-generated story + assets served when an API call fails | P5 |

---

## Deferred (documented in the archive, not built now)

| Domain | Deferred components |
|--------|---------------------|
| Media | Podcast agent & stitching (`C-AG-04`, `C-MEDIA-01/02`), video/audiogram (`C-AG-05`, `C-MEDIA-03`), PDF anthology (`C-MEDIA-04`) |
| Orchestration | Job queue (`C-BE-07`), agent orchestrator (`C-AG-09`), event workflow (`C-AR-02`), memory store (`C-AG-10`) |
| Trust & safety | Chat moderation (`C-AG-07`, `C-TRUST-04`), PII shield (`C-TRUST-05`), crisis routing (`C-TRUST-07`), full consent/RLS (`C-DATA-04`, `C-TRUST-03/08`), evaluation harness (`C-TRUST-09`) |
| Connection | Penpal matching & chat UI (`C-AG-08`, `C-FE-06`) |
| Identity | Supabase Auth & roles (`C-DATA-02`, `C-FE-08`), Postgres schema (`C-DATA-01` as real DB), storage buckets (`C-DATA-03`) |
| Ops | Docker Compose (`C-OPS-02`), CI/CD (`C-OPS-03`), observability (`C-OPS-04`), full test suite (`C-OPS-05`) |
| Business | Market sizing, competition, unit economics, GTM, pitch deck, survey (`C-BIZ-*`, `C-DEL-*`) |

## Rules

- **One component = one responsibility.**
- Acceptance criteria live in [`../MVP.md`](../MVP.md), not here.
- Do **not** add a component to this list without also adding its build step / acceptance
  criterion to `MVP.md`.
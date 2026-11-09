# HistorAI — MVP Plan

> The single, definitive build plan. Replaces the 73-component product outline.
> Goal: **demonstrate one complete loop**, not build a product.
> 2 people · 30 hours · local demo.

---

## 1. Decisions (agreed)

| Decision | Choice |
|----------|--------|
| Stack | **One Next.js app (TypeScript)** — UI + API routes + OpenAI calls in one codebase |
| Input | **Voice and typed text** |
| Output format | **Text article only** (podcast + video deferred) |
| Grounding review | **Kept** — no fabricated facts |
| Storage | **PostgreSQL via Prisma** + local uploads (see [`plan/postgres-migration.md`](./plan/postgres-migration.md)) |
| Login | **Email + password** with server-side sessions (Argon2id, opaque cookies) |
| Demo | **Local** (`pnpm dev`) |
| Docs | Old detail archived in [`docs/future/`](./docs/future/) |

---

## 2. The one demo loop (everything serves this)

```
Senior sees a prompt
      │
      ▼
Senior records a 30–60s answer  ── or types it
      │
      ▼
Whisper transcribes it
      │
      ▼
GPT turns the transcript into a short article
      │
      ▼
GPT grounding check: "did it add any facts?"  → score + verdict
      │
      ▼
Senior taps "Approve & Publish"
      │
      ▼
Article appears in the youth feed
```

If those steps work live, the MVP is done.

---

## 3. Components kept (16)

Full details in [`component/README.md`](./component/README.md).

**Frontend:** `C-FE-01` app shell & routes · `C-FE-02` senior input/review UI ·
`C-FE-03` browser voice recording · `C-FE-04` youth feed & article view ·
`C-FE-07` accessibility basics

**Backend (route handlers):** `C-BE-01` API routes · `C-BE-03` story intake ·
`C-BE-05` approve/publish flag

**AI:** `C-AG-02` transcription & metadata · `C-AG-03` article generation ·
`C-AG-06` grounding review

**Integrations:** `C-INT-01` OpenAI GPT · `C-INT-02` Whisper

**Data & Ops:** `C-DATA-01` PostgreSQL store (Prisma) · `C-OPS-01` config & secrets ·
`C-OPS-06` mock fallback

Everything else is deferred — see [`docs/future/README.md`](./docs/future/README.md).

---

## 4. Data model (PostgreSQL)

Domain data (users, credentials, sessions, stories, questions, topics, votes, likes,
conversations, chat, reports) lives in PostgreSQL, modeled in
[`prisma/schema.prisma`](./prisma/schema.prisma) and reached through Prisma from the `lib/*`
repositories. A `Story` keeps its prompt, transcript, generated `article`, `metadata`,
`groundingScore`, `piiDetected`, and `status` (`draft | reviewed | published`) as columns/JSON.

- Raw audio → `data/uploads/` (git-ignored); moving it to object storage is a follow-up.
- Committed sample content lives in `eval/fixtures/` and is loaded with `npm run db:seed:test`.
- Helpers live in `lib/store.ts` and the other `lib/*` repository modules.

**Auth:** registration and login are email + password; passwords are Argon2id hashes and
sessions are opaque, DB-backed, httpOnly cookies. See [`plan/postgres-migration.md`](./plan/postgres-migration.md).

---

## 5. Build order

| Step | Outcome you can see | Owner |
|------|---------------------|-------|
| 1. Shell | `/senior` and `/youth` render; JSON store works | Both |
| 2. Record/type + transcribe | Submit audio or text → transcript shown | A: API · B: UI |
| 3. Article + review | Transcript → article + grounding score | A: API · B: UI |
| 4. Approve + feed | Approve → article appears on `/youth` | Both |
| 5. Fallback + polish | Demo runs offline; errors handled | Both |

Hour budget and day-by-day split: [`plan/ROADMAP.md`](./plan/ROADMAP.md).

---

## 6. Acceptance criteria

- **AC-1** — A 30–60s recording *or* typed text produces a transcript in the UI.
- **AC-2** — The transcript produces a readable article that reads as editorial, not raw transcript.
- **AC-3** — The grounding check returns a score (1–5); an injected fabricated fact scores
  below threshold and is **not** auto-approved.
- **AC-4** — Nothing appears on `/youth` unless its status is `published` via the senior's
  approve action.
- **AC-5** — With `OPENROUTER_API_KEY` missing/unreachable, the fallback story still serves the
  whole loop.
- **AC-6** — `pnpm install && pnpm dev` runs the app locally with one documented `.env.local`.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Whisper/GPT latency blows the <60s KPI | Draft article from text first; stream status to UI |
| Live API fails during the demo | `C-OPS-06` fallback story, rehearsed |
| Two people collide in one Next.js app | Split by folder: A owns `app/api` + `lib`, B owns `app/senior` + `app/youth` |
| Scope creep back toward the full product | This file and `component/README.md` are the only scope source of truth |

---

## 8. When to add back deferred work

Only after M5 is done **and** rehearsed:
1. Podcast (audio stitching) — `C-AG-04`, `C-MEDIA-01/02`, `C-INT-05`
2. Auth/accounts — `C-DATA-02`, `C-FE-08`
3. Real database + chat safety — `C-DATA-01/04`, `C-AG-07`, `C-TRUST-*`
4. Video — `C-AG-05`, `C-MEDIA-03`

Copy the relevant archived component into `component/README.md` and add a step here.
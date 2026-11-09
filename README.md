# HistorAI — "When I Was Your Age"

> Bridging generational wisdom and purpose through agentic AI.
> UMass Boston · 2026 PEAAII Agentic AI Applications Hackathon

HistorAI lets a young person (**Drop**) ask a question. An older adult (**River**) answers it
out loud. AI transcribes the answer, turns it into a clean, readable article, and runs a
grounding review so nothing is invented. The River approves it, and the article appears in the
youth feed. Published stories can also be woven into a personal listening episode.

This repository is a **demonstrable MVP**, not the full product. 

---

## Quick start

### Prerequisites

- **Node.js 20+** (tested on Node 22) — <https://nodejs.org>
- **npm** (the repo ships a `package-lock.json`; `pnpm`/`yarn` are not required)
- **Docker** (for the local PostgreSQL database) — <https://www.docker.com/products/docker-desktop/>
- An **OpenRouter API key** — <https://openrouter.ai/keys>

### 1. Install dependencies

This step is identical on every platform:

```bash
npm install
```

### 2. Configure environment variables

The app needs an OpenRouter API key. Copy the example file and then edit the copy.

**macOS / Linux (Terminal, zsh/bash)**

```bash
cp .env.example .env.local
```

**Windows (PowerShell)**

```powershell
Copy-Item .env.example .env.local
```

**Windows (Command Prompt)**

```bat
copy .env.example .env.local
```

Now open `.env.local` in any text editor and set at least:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

> `.env` and `.env.local` are git-ignored. Never commit real keys.
> Next.js loads `.env.local` automatically for local development.

### 3. Start PostgreSQL

Data lives in PostgreSQL. Start the local database with Docker and apply the migrations:

```bash
npm run db:up        # docker compose up -d db
npm run db:migrate   # prisma migrate dev — creates the schema
```

`npm run db:check` confirms connectivity. To use a hosted database (Neon) instead of Docker, see
[`docs/deployment.md`](./docs/deployment.md).

To load the committed sample content (users, stories, questions, chat) for local development:

```bash
npm run db:seed:test # dev/test only; refuses to run in production
```

### 4. Start the development server

The `npm` command is the same everywhere — only the terminal you use differs. Follow the block
for your operating system.

**macOS**

1. Open **Terminal** (Applications → Utilities → Terminal).
2. Change into the project folder:

   ```bash
   cd /path/to/UMass-Hackathon-2026
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open <http://localhost:3000> in your browser.
5. The first time you record a voice answer, macOS asks for **microphone permission** — click
   **Allow** (and reload the page if the recorder does not pick up audio).

**Windows**

1. Open **PowerShell** (or Windows Terminal).
2. Change into the project folder:

   ```powershell
   cd C:\path\to\UMass-Hackathon-2026
   ```

3. Start the dev server:

   ```powershell
   npm run dev
   ```

4. Open <http://localhost:3000> in your browser.
5. If **Windows Defender Firewall** asks whether to allow Node.js, choose **Allow access** on
   private networks.
6. If PowerShell refuses to run `npm` with an execution-policy error, either run this once:

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

   …or use **Command Prompt** instead, running `npm.cmd run dev`.

### 5. Try the demo loop

1. On `/login`, choose **I'm a River** (older adult) or **I'm a Drop** (young person).
2. Complete onboarding (name, age, email, and password).
3. As a **Drop**, browse questions and ask a new one.
4. As a **River**, pick a question and answer it by voice or text. You can also use the
   AI interviewer to have a conversation first.
5. Review the generated article and the grounding/safety results, then approve and publish.
6. Published stories appear on `/youth`, and `/podcasts` can turn them into a listening episode.

To read without creating content, choose **Continue as a visitor** on `/login`.

### Production build

Run these two commands on any platform:

```bash
npm run build
npm start
```

The app then runs on <http://localhost:3000> by default.

For a hosted deployment (Neon + container host, migrations in CI, backups/restore), follow
[`docs/deployment.md`](./docs/deployment.md).

To use another port, the syntax differs by shell:

```bash
# macOS / Linux
PORT=3001 npm run dev
```

```powershell
# Windows PowerShell
$env:PORT=3001; npm run dev
```

```bat
:: Windows Command Prompt
set PORT=3001 && npm run dev
```

---

## Environment variables

Copy [`.env.example`](./.env.example) and fill in the values you need. Only the API key is
required; everything else has a default.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | **Yes** | local Docker default | PostgreSQL connection used at runtime (pooled in production). |
| `DIRECT_URL` | **Yes** | same as `DATABASE_URL` | Direct PostgreSQL connection used by migrations and backups. |
| `OPENROUTER_API_KEY` | **Yes** | — | Authenticates all AI requests (chat, speech-to-text, audio conversation, podcasts). |
| `SESSION_SECRET` | Production | — | Required in production (fails closed if missing). Session cookies are opaque DB-backed tokens; the secret is reserved for future signing needs. |
| `SMTP_HOST` / `SMTP_FROM` (+ port/user/password) | Production | — | Send password-reset and verification email. Unset in production makes sending an error; in development links are logged to the console. Any SMTP provider works (Resend recommended). |
| `SEED_USER_PASSWORD` | Dev/test | `historai-dev-password` | Shared password assigned to the seeded users by `npm run db:seed:test`; the script refuses to run in production. |
| `BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter API base URL. |
| `LLM_MODEL` | No | `openai/gpt-4o-mini` | Fallback model for every agent. |
| `WRITING_MODEL` | No | `LLM_MODEL` | Model used for article generation and revision. |
| `REVIEW_MODEL` | No | `LLM_MODEL` | Model used for the independent grounding review. |
| `STT_MODEL` | No | `openai/whisper-large-v3-turbo` | Speech-to-text model. |
| `TTS_MODEL` | No | `google/gemini-3.8-flash-lite-tts` | Reserved text-to-speech model setting (the Listen button uses the browser Web Speech API). |
| `AUDIO_MODEL` | No | `openai/gpt-audio-mini` | Native speech-to-speech conversation model. |
| `AUDIO_VOICE` | No | `sage` | Voice used for spoken AI replies. |
| `AUDIO_SAMPLE_RATE` | No | `24000` | PCM sample rate for streamed audio. |
| `CONVERSATION_MAX_TURNS` | No | `12` | Maximum turns in an AI interview. |
| `CONVERSATION_MAX_AUDIO_HISTORY_TURNS` | No | `2` | How many audio turns are kept in conversation context. |

---

## What the app does

### Core loop

```
River gets a question
      │
      ▼
Answers by voice or text  (or talks with an AI interviewer)
      │
      ▼
Whisper transcribes the answer
      │
      ▼
LLM turns the transcript into a short article
      │
      ▼
Safety gate → grounding review (no invented facts)
      │
      ▼
River approves and publishes
      │
      ▼
Article appears in the youth feed  →  optional podcast episode
```

### Implemented features

- **Email + password accounts** — River/Drop registration and sign-in, onboarding, editable
  profiles, public profile pages, and a read-only visitor mode. Sessions are server-side,
  revocable, and support multiple devices.
- **Questions** — ask on a dedicated page, see up to three similar existing questions while
  typing, browse, filter by topic, sort, and upvote. Drops can follow each question's state
  (waiting, being answered, answered), edit it while no story is linked, and withdraw it
  with a confirmation. Upvotes are tied to the signed-in user (one per account, toggleable).
- **Search** — a header search opens `/search`, matching questions, published stories, and
  public profiles.
- **Global quick links** — a header menu (hidden on `/login` and `/onboarding`) reaches
  popular/unanswered questions, recent answers, and your profile from every screen.
- **Guided product tour** — a first-run, role-aware walkthrough of the site with a replay
  button on `/help`.
- **Voice and typed answers** — browser `MediaRecorder` capture plus a text fallback.
- **AI interviewer** — optional real-time speech-to-speech conversation to draw out a story.
- **Transcription & metadata** — speech-to-text plus topic/summary extraction.
- **Article generation** — transcript → editorial article.
- **Safety gate** — family-friendly review with automatic revision for soft issues and a hard
  block for disallowed content.
- **Grounding review** — checks whether the article invented facts and assigns a score.
- **Approval gate** — only a River can publish, and only from the reviewed state.
- **Youth feed & article view** — published stories only, with large-type and accessibility
  controls.
- **Podcast builder & player** — `/podcasts` weaves published stories into a 15-, 30-, or
  45-minute listening episode, with play/pause/stop, 15-second skip, a seek bar, and subtitles.
- **Share & copy actions** — stories, questions, and profiles can be shared via the Web Share
  API where available, falling back to copying a link.
- **Private 1:1 messaging** — signed-in users can message each other, but a River cannot
  start a new conversation with a Drop under 18 (enforced on the server and hidden in the UI).
  Every outbound message is screened server-side (scams, PII, links, abuse, crisis) before
  it is stored, with block/report and per-user rate limits. Client polling every ~4 s.
- **Story likes & connection pop-up** — any signed-in user can like a published story.
  When someone else who liked the same story shares your interests, a one-tap pop-up
  offers to say hello through private messaging.
- **Reporting** — readers can report a published story, and chat participants can report or
  block each other.
- **PostgreSQL storage** — all domain data lives in PostgreSQL accessed through Prisma; local development uses a Docker Compose database. Audio uploads remain on local disk (`data/uploads/`, see `docs/deployment.md`).

### Pages

| Route | Description |
|-------|-------------|
| `/` | Question explorer (landing page) |
| `/login` | Email + password sign-in, role choice for new accounts, or visitor mode |
| `/onboarding` | Create an account and profile |
| `/search` | Search questions, stories, and people |
| `/questions` | Browse questions |
| `/questions/new` | Ask a question (Drops) |
| `/questions/mine` | My questions, with status, edit, and withdraw |
| `/questions/[id]` | Question detail |
| `/senior` | River dashboard: choose a question to answer |
| `/senior/conversation` | AI speech-to-speech interview |
| `/senior/review/[id]` | Review, revise, approve, and publish an article |
| `/youth` | Published story feed |
| `/youth/[id]` | Read a published story |
| `/podcasts` | Build and play a listening episode from published stories |
| `/messages` | Private message inbox (signed-in users) |
| `/messages/[threadId]` | A 1:1 conversation with its composer |
| `/connect` | Directory of Rivers to connect with (signed-in users) |
| `/profile` | Edit your own profile |
| `/profile/[id]` | Public profile |
| `/help` | Help, FAQ, and tour replay |

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/intake` | Save an answer (audio or text) and create a story; audio may be typed later if transcription fails |
| `POST /api/generate` | Generate or rewrite the article and run safety/grounding review |
| `PATCH /api/stories/[id]` | Edit the answer and/or the story text; strict River ownership; `expectedUpdatedAt` guards conflicts |
| `DELETE /api/stories/[id]` | Permanently delete a story and cascade to likes, question links, conversations, and uploads |
| `POST /api/stories/[id]/check` | Re-run the safety and accuracy checks on the current article |
| `POST /api/stories/[id]/unpublish` | Take a published story off Read stories (keeps likes and the question link) |
| `POST /api/stories/[id]/restore` | Restore the one saved previous article version |
| `POST /api/approve` | Publish a reviewed, checked story |
| `GET /api/questions` | List questions (with filtering/sorting) |
| `POST /api/questions` | Ask a question; validates length/topics and runs the safety screen |
| `GET /api/questions/similar?text=…` | Up to 3 similar questions for the ask form; no author ids |
| `PATCH /api/questions/[id]` | Edit an owned question while no story is linked (409 otherwise) |
| `DELETE /api/questions/[id]` | Withdraw an owned question and its votes while no story is linked (409 otherwise) |
| `POST /api/questions/upvote` | Upvote/un-vote a question (per signed-in user) |
| `POST /api/podcasts` | Build a podcast episode plan from published stories |
| `POST /api/reports` | Report a story, question, answer, message, or user |
| `POST /api/stories/[id]/like` | Like/unlike a published story; returns an interest-based match |

| `GET /api/chat/threads` | List the signed-in user's conversations |
| `POST /api/chat/threads` | Get or create a 1:1 conversation; Rivers are refused for Drops under 18 |
| `GET /api/chat/threads/[id]/messages` | Fetch thread history (with `?after=` polling) |
| `POST /api/chat/threads/[id]/messages` | Screen and send a message |
| `POST /api/chat/threads/[id]/read` | Mark a thread read |
| `POST /api/chat/threads/[id]/block` | Block the other participant |
| `GET /api/chat/unread` | Unread count for the header badge |
| `POST /api/auth/register` | Create a User + Credential and start a session |
| `POST /api/auth/login` | Sign in with email + password |
| `POST /api/auth/logout` | Revoke the current session and clear the cookie |
| `POST /api/auth/password/forgot` | Request a password-reset link (same response for unknown emails) |
| `POST /api/auth/password/reset` | Consume a reset token and set a new password |
| `POST /api/auth/password` | Change the password for the signed-in user |
| `POST /api/auth/verify` | Verify an email address with a token |
| `POST /api/auth/verify/resend` | Resend the verification email |
| `PATCH /api/auth/profile` | Update the signed-in profile |
| `POST /api/auth/visitor` | Enter read-only visitor mode |
| `POST /api/conversation` | Start an AI interview |
| `POST /api/conversation/[id]/greet` | Open a conversation |
| `POST /api/conversation/[id]/turn` | Send a conversation turn |
| `POST /api/conversation/[id]/end` | End a conversation and produce a transcript |

All `/api/stories/[id]/*` routes require a signed-in River and strict ownership: a story with no
`authorId` (legacy content) is never editable, deletable, or publishable by a River. `PATCH`
accepts `{ transcript?, article?, expectedUpdatedAt }`; a mismatch returns `409`. Editing an
article always saves first, then re-runs the checks, and takes a published story off Read stories
until it is published again. `transcript` is limited to 20,000 characters and `article` to
30,000 characters; other values return `400`.

The frozen API contract for the original MVP routes is in
[`docs/api-contract.md`](./docs/api-contract.md).

---

## Stack & structure

Single **Next.js (App Router) + TypeScript** application. UI, API route handlers, and AI calls
all live in one codebase — no separate backend service.

| Layer | Choice |
|-------|--------|
| App | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Voice | Browser `MediaRecorder` API + streaming PCM audio |
| AI | OpenRouter (chat, Whisper speech-to-text, native audio conversation, podcast host) |
| Storage | PostgreSQL 16 via Prisma (local Docker Compose; Neon in production) |
| Auth | Argon2id credentials; opaque httpOnly, DB-backed, revocable sessions |

```text
app/
  api/                    # route handlers (auth, questions, intake, generate, approve,
                          #   reports, likes, chat, conversation, podcasts)
  login/ onboarding/      # auth entry screens
  senior/                 # River dashboard, AI interview, article review
  youth/                  # published story feed and article view
  questions/              # question browser and detail pages
  podcasts/               # podcast builder and player
  profile/                # own profile and public profiles
  search/                 # search across questions, stories, and people
  messages/ connect/      # private messaging and River directory
  help/                   # help + FAQ
components/
  chat/ podcast/ tutorial/ ui/   # feature-grouped React UI components
lib/
  client/                 # browser-side audio helpers (recorder, VAD, PCM player, SSE)
  *.ts                    # AI clients, prompts, store, session, domain helpers
prompts/                  # agent prompt files (writing, review, safety, revision,
                          #   conversation, chat safety, podcast)
data/
  uploads/                # raw audio (git-ignored)
prisma/                   # Prisma schema + committed migrations
docs/deployment.md        # hosted Postgres, migrations in CI, backups/restore
docs/                     # API contract
eval/                     # evaluation harness + committed results (see below)
  fixtures/               # committed JSON seed content for tests/dev
public/                   # static assets (logo, hero art)
middleware.ts             # coarse route guard
MVP.md                    # the single build plan
```

### Notes on storage

- **PostgreSQL is the database.** Domain data (users, credentials, sessions, questions, stories,
  votes, likes, conversations, chat, and reports) lives in PostgreSQL. The application reaches it
  through Prisma via `lib/db.ts`; see [`prisma/schema.prisma`](./prisma/schema.prisma).
- **Local development** uses the Docker Compose database: `npm run db:up`, then `npm run db:migrate`.
- **Sample content** lives as JSON fixtures in `eval/fixtures/` and can be loaded with
  `npm run db:seed:test` (dev/test only). Production data lives exclusively in PostgreSQL.
- **Uploaded audio** is still written to `data/uploads/` and is git-ignored (moving it to object
  storage is a follow-up; see `docs/deployment.md`).
- **Sessions** are opaque, httpOnly cookies backed by a `Session` row; passwords are Argon2id hashes.
  Secrets and required environment variables are listed above.
- **Production** configuration, pooling, migrations, and the backup/restore runbook live in
  [`docs/deployment.md`](./docs/deployment.md).

---

## Evaluation

The evaluation harness lives in [`eval/`](./eval/README.md) and has three layers so logic,
agent quality, and the integrated product can be checked separately:

| Layer | Command | Latest result |
|-------|---------|---------------|
| Offline (no network) | `npm run eval` | **102/102** — server-derived verdicts, age validation, chat regex patterns |
| DB repositories | `npm run eval:db` | **63/63** — Postgres CRUD, cascades, concurrency, token/session rules |
| Live agents | `npm run eval:live` | **8/8** — writing, independent grounding review, safety, semantic chat screen |
| End-to-end HTTP | `npm run dev` + `npm run eval:e2e` | **62 passed**, 1 tracked known issue, 3 skipped — publish gates, auth lifecycle, feed isolation, likes/match, chat screening |

Every run writes `eval/results/{offline,live,e2e}.{json,md}` with the expected and actual
outcome, status, and latency per case. The known issue is a reproduced limitation, not an
undiagnosed failure: the display-name safety gate rejects any name containing the product
term "Drop" (see [`eval/README.md`](./eval/README.md)).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Missing required environment variable OPENROUTER_API_KEY` | Create `.env.local` from `.env.example` and set the key (see Quick Start step 2). Restart `npm run dev`. |
| AI requests fail / 502 errors | Check the key, account credits, and network access to OpenRouter. The app surfaces upstream errors. |
| Port 3000 already in use | Use another port — macOS/Linux: `PORT=3001 npm run dev`; PowerShell: `$env:PORT=3001; npm run dev`; Command Prompt: `set PORT=3001 && npm run dev`. |
| Audio upload does not work | Allow microphone access in the browser. On some browsers, `localhost` is required for `MediaRecorder`; use `http://localhost:3000`, not a LAN IP. |
| PowerShell blocks `npm run …` (`npm.ps1 cannot be loaded`) | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt / `npm.cmd`. |
| Windows Defender Firewall prompt on first `npm run dev` | Allow Node.js access on private networks. |
| Database connection fails | Start Postgres with `npm run db:up`, then `npm run db:check`. For a hosted database, verify `DATABASE_URL`/`DIRECT_URL` in `.env.local`. |
| Fresh clone has no data | Run `npm run db:migrate`, then optionally `npm run db:seed:test` for sample content (see Quick Start step 3). |


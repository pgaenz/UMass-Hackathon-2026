# HistorAI — "When I Was Your Age"

> Bridging generational wisdom and purpose through agentic AI.
> UMass Boston · 2026 PEAAII Agentic AI Applications Hackathon

HistorAI lets a young person (**Drop**) ask a question. An older adult (**River**) answers it
out loud. AI transcribes the answer, turns it into a clean, readable article, and runs a
grounding review so nothing is invented. The River approves it, and the article appears in the
youth feed.

This repository is the **demonstrable MVP**, not the full product. The long-term vision is
archived in [`docs/future/`](./docs/future/).

---

## Quick start

### Prerequisites

- **Node.js 20+** (tested on Node 22)
- **npm** (the repo ships a `package-lock.json`; `pnpm`/`yarn` are not required)
- An **OpenRouter API key** — <https://openrouter.ai/keys>

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and set at least:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

> `.env` and `.env.local` are git-ignored. Never commit real keys.
> Next.js loads `.env.local` automatically for local development.

### 3. Run the development server

```bash
npm run dev
```

Open <http://localhost:3000> in your browser.

### 4. Try the demo loop

1. On `/login`, choose **I'm a River** (older adult) or **I'm a Drop** (young person).
2. Complete onboarding (name + age). No password is required.
3. As a **Drop**, browse questions and ask a new one.
4. As a **River**, pick a question and answer it by voice or text. You can also use the
   AI interviewer to have a conversation first.
5. Review the generated article and the grounding/safety results, then approve and publish.
6. Published stories appear on `/youth`.

To read without creating content, choose **Continue as a visitor** on `/login`.

### Production build

```bash
npm run build
npm start
```

The app then runs on <http://localhost:3000> by default. Set `PORT` to use another port.

---

## Environment variables

Copy [`.env.example`](./.env.example) and fill in the values you need. Only the API key is
required; everything else has a default.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENROUTER_API_KEY` | **Yes** | — | Authenticates all AI requests (chat, speech-to-text, audio conversation). |
| `SESSION_SECRET` | Production | dev fallback | Signs the passwordless session cookie. Set a long random string in production. |
| `BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter API base URL. |
| `LLM_MODEL` | No | `openai/gpt-4o-mini` | Model used for article generation, grounding review, and safety checks. |
| `STT_MODEL` | No | `openai/whisper-large-v3-turbo` | Speech-to-text model. |
| `TTS_MODEL` | No | `google/gemini-3.8-flash-lite-tts` | Reserved text-to-speech model setting. |
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
Article appears in the youth feed
```

### Implemented features

- **Passwordless roles & profiles** — River/Drop login, onboarding, editable profiles, public
  profile pages, and a read-only visitor mode.
- **Questions** — ask, browse, filter by topic, sort, and upvote questions. Upvotes are
  tied to the signed-in user (one per account, toggleable), not the browser.
- **Search** — a header search opens `/search`, matching questions, published stories, and
  public profiles.
- **Global quick links** — a header menu (hidden on `/login` and `/onboarding`) reaches
  popular/unanswered questions, recent answers, and your profile from every screen.
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
- **Private 1:1 messaging** — any signed-in user can message any other user.
  Every outbound message is screened server-side (scams, PII, links, abuse, crisis) before
  it is stored, with block/report and per-user rate limits. Client polling every ~4 s.
- **Story likes & connection pop-up** — any signed-in user can like a published story.
  When someone else who liked the same story shares your interests, a one-tap pop-up
  offers to say hello through private messaging (`plan/LIKES.md`).
- **Reporting** — readers can report a published story, and chat participants can report or
  block each other.
- **File-based storage** — JSON files in `data/`, no database.

### Pages

| Route | Description |
|-------|-------------|
| `/` | Question explorer (landing page) |
| `/login` | Role choice, returning-profile picker, or visitor mode |
| `/onboarding` | Create a profile |
| `/search` | Search questions, stories, and people |
| `/questions` | Browse and ask questions |
| `/questions/[id]` | Question detail |
| `/senior` | River dashboard: choose a question to answer |
| `/senior/conversation` | AI speech-to-speech interview |
| `/senior/review/[id]` | Review, revise, approve, and publish an article |
| `/youth` | Published story feed |
| `/youth/[id]` | Read a published story |
| `/messages` | Private message inbox (signed-in users) |
| `/messages/[threadId]` | A 1:1 conversation with its composer |
| `/connect` | Directory of Rivers to connect with (signed-in users) |
| `/profile` | Edit your own profile |
| `/profile/[id]` | Public profile |
| `/help` | Help and frequently asked questions |

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/intake` | Accept audio or text, transcribe, and create a draft story |
| `POST /api/generate` | Generate an article and run safety/grounding review |
| `POST /api/approve` | Publish a reviewed story |
| `GET /api/questions` | List questions (with filtering/sorting) |
| `POST /api/questions` | Ask a question |
| `POST /api/questions/upvote` | Upvote/un-vote a question (per signed-in user) |
| `POST /api/reports` | Report a story, question, answer, message, or user |
| `POST /api/stories/[id]/like` | Like/unlike a published story; returns an interest-based match |
| `GET /api/chat/threads` | List the signed-in user's conversations |
| `POST /api/chat/threads` | Get or create a 1:1 conversation |
| `GET /api/chat/threads/[id]/messages` | Fetch thread history (with `?after=` polling) |
| `POST /api/chat/threads/[id]/messages` | Screen and send a message |
| `POST /api/chat/threads/[id]/read` | Mark a thread read |
| `POST /api/chat/threads/[id]/block` | Block the other participant |
| `GET /api/chat/unread` | Unread count for the header badge |
| `POST /api/auth/login` | Create a passwordless profile + session |
| `POST /api/auth/session` | Demo sign-in to an existing profile (no password) |
| `POST /api/auth/logout` | Clear the session |
| `PATCH /api/auth/profile` | Update the signed-in profile |
| `POST /api/auth/visitor` | Enter read-only visitor mode |
| `POST /api/conversation` | Start an AI interview |
| `POST /api/conversation/[id]/greet` | Open a conversation |
| `POST /api/conversation/[id]/turn` | Send a conversation turn |
| `POST /api/conversation/[id]/end` | End a conversation and produce a transcript |

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
| AI | OpenRouter (chat, Whisper speech-to-text, native audio conversation) |
| Storage | JSON files in `data/` + local `data/uploads/` (no DB) |
| Auth | Signed, httpOnly cookie session; passwordless role + profile |

```text
app/
  api/                    # route handlers (auth, questions, intake, generate, approve, reports, conversation)
  login/ onboarding/      # auth entry screens
  senior/                 # River dashboard, AI interview, article review
  youth/                  # published story feed and article view
  questions/              # question browser and detail pages
  profile/                # own profile and public profiles
components/               # React UI components
lib/                      # AI clients, prompts, store, session, domain helpers
prompts/                  # agent prompt files (writing, review, safety, revision)
data/                     # JSON "database" (users, questions, stories, conversations)
  uploads/                # raw audio (git-ignored)
docs/                     # API contract and archived full-product vision
plan/                     # profiles, safety, and roadmap plans
MVP.md                    # the single build plan
```

### Notes on storage

- The "database" is a set of JSON files in `data/`: `users.json`, `questions.json`,
  `stories.json`, `conversations.json`, and `chat.json` (private messages).
- Uploaded audio is written to `data/uploads/` and is git-ignored.
- Seed users, questions, and stories are committed so the demo works without prior data.
- Swapping in a real database later means reimplementing `lib/store.ts` and related helpers.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Missing required environment variable OPENROUTER_API_KEY` | Create `.env.local` from `.env.example` and set the key. Restart `npm run dev`. |
| AI requests fail / 502 errors | Check the key, account credits, and network access to OpenRouter. The app surfaces upstream errors. |
| Port 3000 already in use | Run `PORT=3001 npm run dev` or stop the other process. |
| Audio upload does not work | Allow microphone access in the browser. On some browsers, `localhost` is required for `MediaRecorder`; use `http://localhost:3000`, not a LAN IP. |
| Changes to `data/*.json` do not appear | The dev watcher intentionally ignores `data/`; refresh the page. |
| Fresh clone has no data | Seed data is committed. If `data/users.json` or `data/stories.json` is missing, restore it from git. |

---

## Status & plans

✅ **MVP implemented and runnable.** The core loop, roles/profiles, questions, voice + text
input, AI interview, safety gate, grounding review, approval, and youth feed are in place.
Private 1:1 messaging (`/messages`, `/connect`) is implemented per [`plan/CHAT.md`](./plan/CHAT.md).

- [`MVP.md`](./MVP.md) — the original 30-hour, 2-person build plan and acceptance criteria.
- [`plan/README.md`](./plan/README.md) — milestone tracking.
- [`plan/PROFILES.md`](./plan/PROFILES.md) — login, roles, profiles, and ownership.
- [`plan/SAFETY.md`](./plan/SAFETY.md) — content safety gate.
- [`plan/CHAT.md`](./plan/CHAT.md) — private 1:1 messaging, discovery, and pre-send screening.
- [`plan/LIKES.md`](./plan/LIKES.md) — story likes and the interest-based match pop-up.
- [`docs/future/`](./docs/future/) — archived full-product vision (podcast/video, matching,
  database, CI/CD, and more).

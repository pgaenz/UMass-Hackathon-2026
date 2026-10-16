# Development Plan HistorAI

## 1. System & Multi-Agent Architecture Design

The backend architecture uses a modular, event-driven pipeline powered by managed APIs and serverless infrastructure to minimize setup overhead.

```
                  ┌─────────────────────────────────────────┐
                  │          Next.js Web Platform           │
                  │   (Senior Voice UI  |  Youth Media UI)  │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │       FastAPI / Supabase Backend        │
                  │      (Database, Auth, Blob Storage)     │
                  └────────────────────┬────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│  Voice AI Agent │           │ Tri-Modal Media │           │  Safety Agent   │
│ (Prompt & Rec)  │           │   Generators    │           │ (Chat Shield)   │
└────────┬────────┘           └────────┬────────┘           └────────┬────────┘
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
│  Audio & Text   │──────────►│ Reviewer Agent  │◄──────────│ Redaction & PII │
│ Source Material │           │ (Grounding/QC)  │           │     Checks      │
└─────────────────┘           └─────────────────┘           └─────────────────┘
```

### Tech Stack
*   **Frontend:** Next.js (React), Tailwind CSS, Web Audio API (for browser voice recording).
*   **Backend & DB:** Python (FastAPI), Supabase (Postgres Database, Auth, Storage Buckets for raw/processed audio).
*   **AI/LLM Services:** OpenAI API (GPT-4o for agent orchestration and article generation; Whisper API for speech-to-text; OpenAI Realtime/TTS for voice interaction), ElevenLabs API (for synthetic AI host voice in podcast intro/outros).
*   **Media Processing:** `ffmpeg` (via Python wrappers) or Creatomate API (for automated video reel/audiogram rendering).

#### Agent Breakdown & Mechanics
1.  **Voice AI Input Agent:**
    *   *Function:* Renders the youth-generated question, records the senior's spoken answer (or engages in a lightweight two-way clarification chat), transcribes audio using Whisper, and extracts structured metadata (topic, tone, key events).
2.  **Tri-Modal Content Creator Agents:**
    *   *Article Agent:* Transforms raw transcript into a structured, magazine-style editorial using strict extractive prompts.
    *   *Podcast Agent:* Writes a podcast script with an AI co-host intro/outro, generates intro/outro audio via ElevenLabs, cleans/denoises senior raw audio, and stitches them into an `.mp3` file.
    *   *Video Agent:* Extracts a punchy 30–60 second audio highlight, generates synchronized word-level captions, and wraps it into a portrait (9:16) video reel or animated audiogram.
3.  **Reviewer Agent (Quality & Grounding Guardrail):**
    *   *Function:* Compares the generated Article, Podcast script, and Video captions against the original Whisper transcript. Scores the output on a 1–5 scale for extractive accuracy, ensures no fabricated facts or deepfakes were added, verifies family-friendliness, and enforces PII redaction.
4.  **Safety Moderation Agent (Anti-Scam & PII Shield):**
    *   *Function:* Intercepts all direct 1-on-1 text messages between youth and seniors in real time. Scans for financial requests, banking details, personal contact leaks, or abusive language before saving messages to the database.

---

## 2. Artifact Ranking (Priority Order)

When building under tight constraints, prioritize core functional pipelines over edge-case security or UI polish:

1.  **Core Data Schema & Voice Input Agent (Highest Priority):** Without capturing raw voice memos and converting them into clean transcripts, no downstream generation is possible.
2.  **Tri-Modal Content Creator Pipeline:** The primary value proposition—turning raw transcript into an Article, Podcast episode, and Video snippet.
3.  **Dual-Interface Web App:** A clean, functional Next.js dashboard providing the senior "1-Tap Record" view and the youth "Media Feed" view.
4.  **Reviewer Guardrail Agent:** Ensures output quality control, extractive grounding checks, and automated publication/holding flags.
5.  **Safety Moderation Agent & 1-on-1 Chat Bridge (Lowest Priority for MVP):** Important for long-term trust, but can be implemented as a simple synchronous filter endpoint during a short hackathon build.

---

## 3. 1-Week Feasibility Scope (2 People × 15 Hours = 30 Total Hours)

### What IS Feasible to Build (In Scope)
*   **Voice Capture:** Browser-based voice recorder uploading directly to Supabase Storage + Whisper API transcription.
*   **Article Generation:** Automated GPT-4o pipeline outputting formatted Markdown articles.
*   **Podcast Stitching:** Python script combining an ElevenLabs-generated intro, the cleaned senior audio clip, and an outro.
*   **Basic Video Audiogram:** Generating a 30-second captioned video clip using a simple cloud video API (e.g., Creatomate or Shotstack) or a serverless `ffmpeg` script.
*   **Dual UI Dashboard:** A functional Next.js app with two toggleable routes (`/senior` and `/youth`).
*   **Basic Reviewer & Safety Checks:** Synchronous OpenAI API moderation and grounding validation calls.

### What to Mock / Defer (Out of Scope for 1-Week Prototype)
*   Complex multi-turn real-time WebSockets for the Voice Agent (use standard single-button recording instead).
*   Custom video rendering engines built from scratch (use third-party video APIs or static canvas previews).
*   Live production mobile apps (stick strictly to a responsive Web app).

---

## 4. Fully-Detailed 1-Week Implementation Plan

### Developer Roles
*   **Dev A (Backend, Multi-Agent Pipeline & AI APIs):** 15 Hours
*   **Dev B (Frontend Next.js, Dual UI & Media Player):** 15 Hours

---

### Phase 1: Setup & Foundation (Total: 6 Person-Hours)
*   **Dev A (3 hrs):**
    *   Set up Supabase project (Database tables: `users`, `prompts`, `stories`, `media_outputs`, `messages`).
    *   Configure Supabase Storage buckets for `raw-audio`, `processed-audio`, and `video-reels`.
    *   Set up FastAPI backend repository with OpenAI and ElevenLabs API credentials.
*   **Dev B (3 hrs):**
    *   Initialize Next.js project with Tailwind CSS.
    *   Build layout shell and route structure: `/senior` (Accessibility Mode) and `/youth` (Feed Mode).
    *   Set up Supabase client authentication.

---

### Phase 2: Voice Input & Transcription Pipeline (Total: 6 Person-Hours)
*   **Dev A (3 hrs):**
    *   Build `/api/voice-input` endpoint: accepts audio file uploads, stores them in Supabase, and runs OpenAI Whisper API to get raw transcript and word-level timestamps.
    *   Write LLM metadata extraction script: extracts topic tags (#History, #Career), summary, and key quotes.
*   **Dev B (3 hrs):**
    *   Build Senior UI (`/senior`): Large font, high contrast, prominent prompt display card ("Question of the Week"), and a clear 1-Tap Record/Stop Web Audio API button.
    *   Connect recording UI to Dev A’s upload API endpoint.

---

### Phase 3: Tri-Modal Generation Engine (Total: 10 Person-Hours)
*   **Dev A (5 hrs):**
    *   **Article Agent:** Prompt GPT-4o to transform Whisper transcript into structured Markdown with title, pull-quotes, and key advice sections.
    *   **Podcast Agent:** Generate intro/outro text via GPT-4o, convert intro/outro to audio using ElevenLabs API, and stitch audio files together using `pydub`/`ffmpeg`.
    *   **Video Agent:** Extract top 30-second quote timestamp and send to Creatomate/Shotstack API (or client-side Waveform player) to return a rendered vertical video reel URL.
*   **Dev B (5 hrs):**
    *   Build Youth Media Feed (`/youth`): Category filter tabs, story card list, and tabbed player for the 3 formats:
        1. *Article Tab:* Rendered Markdown essay.
        2. *Podcast Tab:* Custom HTML5 Audio Player with episode art.
        3. *Video Tab:* Embedded vertical video player.

---

### Phase 4: Guardrail & Safety Agents (Total: 5 Person-Hours)
*   **Dev A (3 hrs):**
    *   **Reviewer Agent Endpoint:** Run a secondary GPT-4o check comparing raw transcript vs. generated media. Returns `grounding_score` (1–5) and `pii_detected` (true/false). Auto-approves if score ≥ 4.
    *   **Safety Moderation Agent:** Build a `/api/chat/send` endpoint that runs incoming text through OpenAI Moderation API + regex/LLM scanner for financial scam words (e.g., "Venmo", "wire transfer", "bank account", "SSN"). Hard-blocks non-compliant messages.
*   **Dev B (2 hrs):**
    *   Integrate 1-Tap Senior Approval button on `/senior` dashboard ("Approve & Publish My Story").
    *   Add simple direct-message drawer on `/youth` story page with real-time error banner if Safety Agent blocks a message.

---

### Phase 5: Integration, End-to-End Testing & Demo Prep (Total: 3 Person-Hours)
*   **Dev A & Dev B Jointly (1.5 hrs each):**
    *   Run end-to-end test: Record 60-second senior voice memo -> Verify Whisper transcription -> Trigger 3-agent generation -> Run Reviewer check -> Approve via Senior UI -> View published media on Youth feed -> Test Safety Agent by attempting a simulated scam message in chat.
    *   Prepare fallback mock data/pre-rendered assets in database to guarantee a zero-glitch pitch demo presentation.
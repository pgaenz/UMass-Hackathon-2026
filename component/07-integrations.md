# Integration Components

All external providers sit behind thin adapter interfaces so they can be mocked and swapped.
Back to index: [`README.md`](./README.md)

---

### `C-INT-01` OpenAI GPT-4o

- **Purpose:** Reasoning, extraction, generation and review across agents.
- **Responsibilities:** Chat/structured-output calls with JSON schema, prompt templates,
  token/cost accounting, retries, timeouts, model pinning.
- **Interfaces:** `complete(schema, messages)`, `extract(...)`, `judge(...)`.
- **Dependencies:** `C-OPS-01`
- **Phase:** P2
- **Acceptance Signals:** Structured outputs validate against `C-BE-09`; usage logged per
  agent; graceful failure.
- **Risks / Open Questions:** Cost; rate limits during demo; nondeterminism in the reviewer.

---

### `C-INT-02` OpenAI Whisper

- **Purpose:** Speech-to-text with word-level timestamps.
- **Responsibilities:** Upload audio, request `verbose_json` with word timestamps,
  language detection, chunking for long audio.
- **Interfaces:** `transcribe(audio) -> {text, words[]}`.
- **Dependencies:** `C-OPS-01`
- **Phase:** P2
- **Acceptance Signals:** Accurate transcript + timestamps for 5-min audio; language
  auto-detected; errors surfaced.
- **Risks / Open Questions:** Accents/dialects; file-size limits; cost.

---

### `C-INT-03` OpenAI Moderation API

- **Purpose:** First-pass content classification for messages and generated media.
- **Responsibilities:** Map moderation categories to `C-TRUST-04` decisions; combine with
  custom scam/PII rules; fail-closed.
- **Interfaces:** `moderate(text) -> categories+scores`.
- **Dependencies:** `C-OPS-01`
- **Phase:** P4
- **Acceptance Signals:** Harassment/hate/self-harm categories captured; feeds the safety
  verdict with reason codes.
- **Risks / Open Questions:** Moderation misses financial-scam semantics → must pair with
  regex/LLM scanner.

---

### `C-INT-04` OpenAI TTS / Realtime (Optional)

- **Purpose:** Optional two-way voice clarification loop with the senior.
- **Responsibilities:** Text-to-speech playback of clarifying questions; optional realtime
  voice conversation mode.
- **Interfaces:** `speak(text) -> audio`; realtime session (stretch).
- **Dependencies:** `C-OPS-01`
- **Phase:** P4+ (out of MVP scope, mocked as single-tap recording)
- **Acceptance Signals:** If enabled, clarifying questions can be heard; otherwise feature
  flag off and deferred.
- **Risks / Open Questions:** Explicitly deferred per the 1-week scope.

---

### `C-INT-05` ElevenLabs API

- **Purpose:** Generate the warm AI host voice for podcast intro/outro.
- **Responsibilities:** Voice selection, text chunking, mp3 generation, caching identical
  intros, cost tracking.
- **Interfaces:** `tts(text, voice_id) -> mp3`.
- **Dependencies:** `C-OPS-01`
- **Phase:** P3
- **Acceptance Signals:** Intro/outro audio generated and stitched; coherent host voice;
  never used to imitate the senior.
- **Risks / Open Questions:** Cost/latency; voice licensing.

---

### `C-INT-06` Creatomate / Shotsack or ffmpeg Render Backend

- **Purpose:** Render video reels/audiograms and provide media conversion.
- **Responsibilities:** Template rendering, caption overlay, audio conversion/denoise,
  webhook/polling for render completion, fallback to local ffmpeg on API failure.
- **Interfaces:** `render(template, assets) -> mp4`, `convert(...)`.
- **Dependencies:** `C-OPS-01`
- **Phase:** P3
- **Acceptance Signals:** One render backend is always available; fallback path produces a
  valid audiogram; outputs stored in `video-reels`.
- **Risks / Open Questions:** Third-party downtime during demo → must have ffmpeg fallback.

---

### `C-INT-07` Supabase SDK

- **Purpose:** Unified access to DB, Auth, Storage and Realtime.
- **Responsibilities:** Client config, JWT handling, repository calls, signed URLs, optional
  realtime subscriptions for chat/status.
- **Interfaces:** Server client (service role) + browser client (anon).
- **Dependencies:** `C-DATA-01/02/03`
- **Phase:** P1
- **Acceptance Signals:** RLS respected under anon client; service role used only server-side;
  secrets never shipped to the browser.
- **Risks / Open Questions:** Key management; accidental service-role exposure.

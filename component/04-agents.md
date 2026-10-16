# Agent Components

HistorAI qualifies as **Agentic AI** because it plans, breaks goals into subtasks, uses
external tools/APIs, keeps memory/context, asks humans for input (Human-in-the-Loop), and
coordinates a **multi-agent workflow**. These are the autonomous workers.

Back to index: [`README.md`](./README.md)

Shared agent schema: `goal · inputs → outputs · tools · memory · guardrails · failure mode`.
Every agent returns structured, schema-validated output; no free-form side effects.

---

### `C-AG-01` Prompt Refinement & Routing Agent

- **Purpose:** Refine a youth's raw question and route it to the best-matched senior.
- **Responsibilities:** Rewrite for open-endedness and dignity, assign topic tags, detect
  sensitivity, select candidates by life profile/interests, avoid over-asking any senior.
- **Inputs → Outputs:** Raw youth question + user profile → `{refined_prompt, topic_tags,
  target_senior_id, rationale}`.
- **Tools:** `C-INT-01` (GPT-4o), profile store (`C-AG-10`), matching query.
- **Guardrails:** No leading/manipulative phrasing; no requests for PII or money.
- **Failure mode:** Fall back to the original question with a generic topic tag.
- **Dependencies:** `C-INT-01`, `C-AG-10`
- **Phase:** P2
- **Acceptance Signals:** Refined prompt preserves intent; routing picks a plausible senior;
  runs in `<5s`.
- **Risks / Open Questions:** Sparse profiles; gaming the matcher.

---

### `C-AG-02` Voice Transcription & Metadata Extraction Agent

- **Purpose:** Convert senior speech into a clean transcript with structure.
- **Responsibilities:** Call Whisper with word timestamps, remove filler words, handle
  pauses, extract `topic`, `tone`, `key_events`, `quotes`, `summary`, `sensitivity_flags`.
- **Inputs → Outputs:** Raw audio (+ language hint) → `{transcript, word_timestamps,
  metadata}`.
- **Tools:** `C-INT-02` (Whisper), `C-INT-01` for metadata.
- **Guardrails:** Never invent words; flag low-confidence segments for human review;
  never paraphrase in the transcript (kept verbatim).
- **Failure mode:** Return verbatim Whisper output + low-confidence flag; block generation.
- **Dependencies:** `C-INT-02`, `C-AG-10`
- **Phase:** P2
- **Acceptance Signals:** 5-min memo transcribed; topic/category auto-assigned; timestamps
  align with audio; noisy/dialect audio flagged.
- **Risks / Open Questions:** Dialects, heavy background noise, code-switching.

---

### `C-AG-03` Article Agent

- **Purpose:** Produce a magazine-style editorial article strictly from the transcript.
- **Responsibilities:** Structure into title, standfirst, pull-quotes, sections, key advice;
  keep first-person senior voice; no added facts.
- **Inputs → Outputs:** Transcript + metadata → Markdown article (`C-MEDIA-04`).
- **Tools:** `C-INT-01` with strict extractive prompt.
- **Guardrails:** `C-TRUST-01` extractive grounding; PII redaction `C-TRUST-05`.
- **Failure mode:** Return a lightly formatted transcript-only draft for human review.
- **Dependencies:** `C-INT-01`, `C-TRUST-01`
- **Phase:** P3
- **Acceptance Signals:** Article facts trace 1:1 to transcript; reviewer score ≥ threshold;
  reads as editorial, not raw transcript.
- **Risks / Open Questions:** Hallucination under long inputs; tone drift.

---

### `C-AG-04` Podcast Agent

- **Purpose:** Package the senior's story as a warm podcast episode.
- **Responsibilities:** Write AI host intro/outro, generate them via ElevenLabs, denoise/
  clean senior audio, stitch intro → story → outro into a single `.mp3`, produce episode art
  + show notes.
- **Inputs → Outputs:** Transcript + cleaned audio → `{episode_mp3, show_notes, episode_art}`.
- **Tools:** `C-INT-01`, `C-INT-05` (ElevenLabs), `C-MEDIA-01/02`.
- **Guardrails:** Host voice must never impersonate the senior; intro/outro must not add
  unverified biographical claims.
- **Failure mode:** Publish senior audio with a text-only show note and no AI host segment.
- **Dependencies:** `C-INT-01`, `C-INT-05`, `C-MEDIA-02`
- **Phase:** P3
- **Acceptance Signals:** Playable mp3 with audible senior voice + host framing; duration
  matches; no voice cloning.
- **Risks / Open Questions:** TTS cost/latency; loudness consistency across segments.

---

### `C-AG-05` Video Agent

- **Purpose:** Create a captioned vertical (9:16) reel or audiogram from the best moment.
- **Responsibilities:** Select a 30–60s highlight, sync word-level captions, choose template,
  render via Creatomate/Shotsack or ffmpeg, return mp4 URL.
- **Inputs → Outputs:** Cleaned audio + timestamps + metadata → `{reel_mp4, caption_file,
  chosen_window}`.
- **Tools:** `C-INT-06`, `C-MEDIA-03`.
- **Guardrails:** Captions must match speech exactly; no synthetic mouth/face manipulation.
- **Failure mode:** Deliver captioned static audiogram (image + waveform) instead of video.
- **Dependencies:** `C-INT-06`, `C-MEDIA-03`
- **Phase:** P3
- **Acceptance Signals:** Rendered 9:16 mp4; captions word-synced; renders within budget.
- **Risks / Open Questions:** Render API quotas/cost; caption accuracy on names.

---

### `C-AG-06` Reviewer / Grounding Guardrail Agent

- **Purpose:** Independent quality-control pass over all generated media.
- **Responsibilities:** Compare each output against the transcript; score 1–5 for extractive
  accuracy; detect fabricated facts/deepfakes; check family-friendliness; detect PII; decide
  `auto_approve` (score ≥ 4, no PII) vs `hold` for human review.
- **Inputs → Outputs:** `{transcript, media_outputs}` → `{grounding_score, pii_detected,
  flags[], verdict}`.
- **Tools:** `C-INT-01`, `C-INT-03`, `C-TRUST-01/05`.
- **Guardrails:** Reviewer is a *separate* context from creators; must cite the transcript
  span supporting/contradicting each claim; fail-closed.
- **Failure mode:** Default to `hold`; never auto-approve on error.
- **Dependencies:** `C-INT-01`, `C-TRUST-01`, `C-TRUST-05`
- **Phase:** P4
- **Acceptance Signals:** Injected fabricated claim produces score < 4 and a hold; clean
  story with score ≥ 4 auto-approves; every verdict has evidence.
- **Risks / Open Questions:** LLM-as-judge reliability; threshold calibration; cost.

---

### `C-AG-07` Safety Moderation & PII Shield Agent

- **Purpose:** Intercept every direct message before it reaches a senior.
- **Responsibilities:** Run OpenAI Moderation + regex/LLM scanner for money requests, bank
  details, SSN/PII, phishing links, abuse; return `{verdict, category, confidence,
  time_to_verdict_ms}`; hard-block unsafe; escalate crisis content.
- **Inputs → Outputs:** Message text (+ sender/receiver context) → allow | block(+reason) |
  escalate.
- **Tools:** `C-INT-03`, `C-INT-01`, regex ruleset, `C-TRUST-07`.
- **Guardrails:** Fail-closed (block if uncertain); log for audit; never leak receiver-side
  PII into sender messages.
- **Failure mode:** Block by default and flag for human review.
- **Dependencies:** `C-INT-03`, `C-TRUST-04`, `C-TRUST-05`
- **Phase:** P4
- **Acceptance Signals:** Simulated scam ("wire transfer", "bank account", "SSN") blocked;
  Time-to-Verdict and detection rate logged for `C-TRUST-09`.
- **Risks / Open Questions:** Evasion/obfuscation; false positives; multilingual scams.

---

### `C-AG-08` Connection / Penpal Matching Agent

- **Purpose:** Turn content engagement into a durable 1-on-1 relationship.
- **Responsibilities:** Compute shared-interest match score, suggest 3 contextual icebreakers
  based on the story, recommend follow-up questions, propose penpal pairing.
- **Inputs → Outputs:** Youth + senior profiles + story → `{match_score, shared_interests[],
  icebreakers[], suggested_followups[]}`.
- **Tools:** `C-INT-01`, profile store, `C-AG-10`.
- **Guardrails:** No sharing of contact details; suggestions must be respectful; both sides
  opt in.
- **Failure mode:** Return generic respectful icebreakers drawn from the story topic.
- **Dependencies:** `C-INT-01`, `C-BE-06`
- **Phase:** P4
- **Acceptance Signals:** Match requires ≥2 shared interests; icebreakers reference the
  story; both-party consent recorded.
- **Risks / Open Questions:** Cold-start profiles; avoiding over-matching.

---

### `C-AG-09` Agent Orchestrator / Workflow Engine

- **Purpose:** Plan and coordinate the multi-agent pipeline for a single story.
- **Responsibilities:** Build the DAG (transcribe → metadata → [article|podcast|video] →
  review → gate), pass context between agents, retry/timeout, aggregate results, emit
  status events, insert human-in-the-loop checkpoints.
- **Inputs → Outputs:** Story id → ordered agent runs → `media_outputs` + review verdict.
- **Tools:** `C-AR-02`, all `C-AG-*` agents.
- **Guardrails:** Enforces that no output skips `C-AG-06`; enforces publication gate.
- **Failure mode:** Persist partial results and mark the run `held` with a reason.
- **Dependencies:** `C-AR-02`, `C-AG-01..08`
- **Phase:** P3
- **Acceptance Signals:** Golden path runs end-to-end; orchestrator state queryable; a forced
  agent failure produces a controlled `held`, not a crash.
- **Risks / Open Questions:** DAG complexity; parallelism budget vs. `<60s` KPI.

---

### `C-AG-10` Memory & Context Store

- **Purpose:** Give agents continuity about a senior, a story and prior interactions.
- **Responsibilities:** Store long-term profile/interests, short-term run context, prior
  questions/answers, story history, match history; expose retrieval to agents.
- **Inputs → Outputs:** Entity ids → relevant context bundle for an agent call.
- **Tools:** Postgres + optional pgvector embeddings; `C-DATA-01`.
- **Guardrails:** Respect consent/visibility scopes; no cross-user leakage; TTL for run
  context.
- **Failure mode:** Return profile-only context; agents must degrade gracefully.
- **Dependencies:** `C-DATA-01`
- **Phase:** P2
- **Acceptance Signals:** Repeat interactions reference prior context; retrieval is scoped
  by user; no PII bleed across users.
- **Risks / Open Questions:** Embedding scope creep; privacy of stored profiles.

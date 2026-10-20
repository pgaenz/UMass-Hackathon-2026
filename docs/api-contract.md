# HistorAI — API contract (Phase 1, frozen)

The four MVP routes and their exact request/response shapes. Both owners code against
this; UI work starts only after these are implemented and reachable.

The persisted model is `Story` in [`lib/types.ts`](../lib/types.ts) (mirrors MVP.md §4).
Responses always wrap stories as objects (`{ story }`, `{ stories }`) so fields can be
added later without breaking clients.

## Decisions

| # | Decision |
|---|----------|
| 1 | LLM/STT/TTS all go through OpenRouter (`config.baseUrl`, `config.sttModel`, `config.ttsModel`). |
| 2 | Audio transport is `multipart/form-data`. |
| 3 | Transcription runs server-side (`C-INT-02`), so the API key stays secret and `C-OPS-06` can mock it. |

## Errors

Every non-2xx response is `{ "error": string }`.

| Status | When |
|--------|------|
| `400` | Missing/invalid input (e.g. no audio and no text). |
| `404` | Unknown story `id`. |
| `409` | Illegal status transition (e.g. approving a `draft`). |
| `502` | Upstream OpenRouter failure. |
| `500` | Anything else. |

## `POST /api/intake`

Creates a `draft` story, saves raw audio (if any), then transcribes and extracts metadata.

- **Content-Type:** `multipart/form-data` (audio) **or** `application/json` (text).

**Audio fields**
| Field | Type | Notes |
|-------|------|-------|
| `audio` | File | The recording. Saved under `data/uploads/`. |
| `prompt` | string | The question shown to the senior. |
| `questionId` | string | Optional. The question this story answers; links the draft to it. Unknown id → `400`. |

**Text body** — `IntakeTextRequest`
```json
{ "inputType": "text", "prompt": "What was your first job?", "text": "...", "questionId": "q-first-job" }
```

**Response `201`**
```json
{ "story": { "id": "...", "status": "draft", "transcript": "...", "metadata": { "topic": "", "summary": "" }, "...": "..." } }
```

Side effects: raw audio written to `data/uploads/`; story persisted via
`createStory()`; `rawAudioPath`, `transcript`, and `metadata` filled in. When
`questionId` is present, the story id is appended to that question's `storyIds`
via `linkStoryToQuestion()`.

## `POST /api/generate`

Turns a stored transcript into an article and runs the grounding review.

- **Content-Type:** `application/json`
- **Body** — `GenerateRequest`: `{ "id": "<story id>" }`
- **Response `200`** — `{ "story": Story }` with `article`, `groundingScore`, `piiDetected` set.
- Status becomes `reviewed` only when the grounding threshold passes; otherwise it stays `draft`.
- **Errors:** `400` missing id, `404` unknown id, `502` upstream failure.

## `POST /api/approve`

Senior consent gate. Publishes a `reviewed` story.

- **Content-Type:** `application/json`
- **Body** — `ApproveRequest`: `{ "id": "<story id>" }`
- **Response `200`** — `{ "story": Story }` with `status: "published"`.
- **Errors:** `400` missing id, `404` unknown id, `409` transition not from `reviewed`.

The only transition is `reviewed → published`. `draft` can never be approved directly.

## `GET /api/stories`

Feed data. Defaults to published stories so `/youth` cannot leak drafts.

- **Query:** `?status=published` (allowed: `draft | reviewed | published`; default `published`).
- **Response `200`** — `{ "stories": Story[] }` (newest first).
- **Errors:** `400` invalid status value.

# Media Pipeline Components

**Stack:** `ffmpeg` (via Python wrappers), Creatomate/Shotsack API, pydub, Markdown tooling.
Back to index: [`README.md`](./README.md)

---

### `C-MEDIA-01` Audio Intake, Denoise & Normalization

- **Purpose:** Turn a raw senior recording into clean, loudness-consistent audio.
- **Responsibilities:** Decode (webm/opus/mp4/wav), trim silence, denoise, normalize
  loudness (EBU R128 / `loudnorm`), convert to a canonical mono/44.1k wav + mp3, preserve
  original alongside processed.
- **Inputs → Outputs:** `raw-audio/*` → `processed-audio/*` + normalized waveform/timestamps.
- **Dependencies:** `C-INT-06`
- **Tech:** ffmpeg, pydub, noisereduce optional.
- **Phase:** P3
- **Acceptance Signals:** Listenable output from a noisy phone recording; durations unchanged
  after trimming; both raw and processed retained.
- **Risks / Open Questions:** Aggressive denoise harming voice; format edge cases.

---

### `C-MEDIA-02` Podcast Stitching

- **Purpose:** Assemble AI host intro + senior story + outro into one episode.
- **Responsibilities:** Loudness-match segments, insert short music sting optional, export
  single `.mp3`, generate show notes and episode art metadata.
- **Inputs → Outputs:** Intro/outro audio (`C-AG-04`) + cleaned story → `episode.mp3`.
- **Dependencies:** `C-MEDIA-01`, `C-INT-05`
- **Tech:** pydub/ffmpeg concat, loudnorm.
- **Phase:** P3
- **Acceptance Signals:** Seamless single file with no clipping; host and senior levels
  balanced; export under time budget.
- **Risks / Open Questions:** Async gap between ElevenLabs generation and stitching.

---

### `C-MEDIA-03` Video / Audiogram Render + Captions

- **Purpose:** Produce a captioned 9:16 short from the chosen highlight.
- **Responsibilities:** Build caption track from word timestamps, pick template, render
  waveform/audiogram + captions with a static image or subtle motion, export mp4, store in
  `video-reels`.
- **Inputs → Outputs:** Highlight window + captions + image → `reel.mp4` + `.srt`.
- **Dependencies:** `C-MEDIA-01`, `C-AG-05`
- **Tech:** Creatomate/Shotsack API or ffmpeg (`drawtext`, `showwaves`).
- **Phase:** P3
- **Acceptance Signals:** Valid 9:16 mp4 plays on mobile; captions match audio; fallback
  static audiogram exists.
- **Risks / Open Questions:** Render cost/time; font/caption styling; API availability.

---

### `C-MEDIA-04` Article Rendering

- **Purpose:** Turn the Article Agent's Markdown into presentation-ready formats.
- **Responsibilities:** Markdown → sanitized HTML for the web player; optional styled PDF /
  "Legacy Book" export combining multiple articles; enforce no raw HTML injection.
- **Inputs → Outputs:** Article Markdown → rendered HTML / PDF anthology.
- **Dependencies:** `C-AG-03`, `C-FE-05`
- **Tech:** `react-markdown` + rehype-sanitize; WeasyPrint/PDF optional.
- **Phase:** P3
- **Acceptance Signals:** Pull-quotes and headings render correctly; output sanitized; legacy
  book export (stretch) produces a valid PDF.
- **Risks / Open Questions:** PDF export is a stretch goal; XSS safety.

# Deliverables & Evaluation Components

Mandatory PEAAII hackathon deliverables + the artifacts that win the room.
Back to index: [`README.md`](./README.md)

---

### `C-DEL-01` GitHub Repository & Runnable Code

- **Purpose:** Mandatory deliverable — judges can inspect and run the system.
- **Responsibilities:** Public repo link, README with setup, env example, seed/mock data,
  working demo path, license, contributor notes, CODEOWNERS/labels optional.
- **Inputs → Outputs:** Codebase → reproducible repo with one-command local run.
- **Dependencies:** all P1–P4 components
- **Phase:** P5
- **Acceptance Signals:** Fresh clone + documented steps runs the end-to-end demo; no secrets
  committed; README shows architecture and evaluation.
- **Risks / Open Questions:** Time to polish setup docs; API key costs for reviewers.

---

### `C-DEL-02` End-to-End Demo Workflow

- **Purpose:** Demonstrate Problem → User Interaction → Agentic Workflow → Result live.
- **Responsibilities:** Scripted 60s memo → Whisper transcript → 3-agent generation →
  reviewer check → senior approval → published youth feed → simulated scam blocked.
- **Inputs → Outputs:** Demo script + deterministic seed data → zero-glitch live run.
- **Dependencies:** `C-DEL-01`, `C-OPS-06`
- **Phase:** P5
- **Acceptance Signals:** Golden path completes within the KPI window; fallback assets exist
  if a live API fails; the safety stress test visibly blocks.
- **Risks / Open Questions:** Live API latency/failure; wifi; rendering during demo.

---

### `C-DEL-03` Evaluation Matrix

- **Purpose:** Satisfy mandatory deliverable #5: representative test cases with expected vs.
  actual outcomes, successful behaviors, limitations/risks + mitigations.
- **Responsibilities:** At minimum the three cases: (1) unstructured 5-min memo → clean
  transcript + 3 formats; (2) follow-up/penpal matching ≥2 shared interests + icebreakers;
  (3) safety guardrail stress test blocks financial data request; plus metrics.
- **Inputs → Outputs:** Harness results (`C-TRUST-09`) → written evaluation table.
- **Dependencies:** `C-TRUST-09`
- **Phase:** P5
- **Acceptance Signals:** Every case states expected, actual, successful behavior, limitation
  and mitigation; actual results come from a real run.
- **Risks / Open Questions:** Presenting failures honestly without undermining confidence.

---

### `C-DEL-04` 11-Slide Pitch Deck & Speaker Scripts

- **Purpose:** Tell the story that wins both AI judges and business leaders.
- **Responsibilities:** 11 slides per blueprint (Title, Team, Problem, Competitors, Market,
  Purpose, How It Works/UI, USP, Future Vision, Responsible AI/Evaluation, Thank You) with
  Rule-of-Three structure, visuals, and speaker scripts for Louis & Philipp's demo slides.
- **Inputs → Outputs:** Business + demo artifacts → final deck + QR codes.
- **Dependencies:** `C-BIZ-*`, `C-DEL-02/03`
- **Phase:** B
- **Acceptance Signals:** Every slide has ≤3 key ideas; agentic-AI framing explicit; claims
  cited; Q&A cheat sheet ready; QR codes resolve.
- **Risks / Open Questions:** Time-boxing the team talk; visual asset production.

---

### `C-DEL-05` Responsible AI Governance Narrative

- **Purpose:** Show AI is used responsibly, not just capably.
- **Responsibilities:** Three pillars: zero-hallucination extractive grounding, anti-scam/PII
  shield, human-in-the-loop consent; ownership/privacy; mapping to Trust scores.
- **Inputs → Outputs:** Trust components → slide + one-pager.
- **Dependencies:** `C-TRUST-*`
- **Phase:** B
- **Acceptance Signals:** Each governance claim links to an implemented control and a test.
- **Risks / Open Questions:** Avoiding overpromising on unbuilt controls.

---

### `C-DEL-06` Validation Survey & Customer Discovery

- **Purpose:** ESM customer-validation evidence and post-pitch feedback loop.
- **Responsibilities:** 5-question validation survey, QR code, persona interviews
  (seniors + youth), willingness-to-pay signal, target-market validation.
- **Inputs → Outputs:** Survey responses → evidence slide + iteration notes.
- **Dependencies:** `C-BIZ-05`
- **Phase:** B
- **Acceptance Signals:** Survey is live and linked; at least a handful of pilot responses
  collected; findings summarized.
- **Risks / Open Questions:** Participant access; small sample.

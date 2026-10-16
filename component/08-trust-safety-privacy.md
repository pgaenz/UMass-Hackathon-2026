# Trust, Safety & Privacy Components

Derived from the **Trust & Robustness Plan** (Guardrails 3/5, Data Boundaries 4/5, Human
Oversight 4/5, Failure Handling 3/5, Evaluation 4/5) and the stress test on scam targeting.
Back to index: [`README.md`](./README.md)

---

### `C-TRUST-01` Extractive Grounding Guardrail

- **Purpose:** Guarantee the AI only organizes provided material and never fabricates.
- **Responsibilities:** Constrain generation to the transcript; provide source spans for
  every claim; forbid external web knowledge; reject outputs lacking grounding.
- **Interfaces:** Grounding check decorator used by all creator agents + reviewer.
- **Dependencies:** `C-INT-01`
- **Phase:** P4
- **Acceptance Signals:** Fabricated-fact injection test fails grounding; no creator agent
  can run without the guardrail applied.
- **Risks / Open Questions:** Long-input dilution; measuring "no fabrication" objectively.

---

### `C-TRUST-02` Reviewer Scoring & Auto-Approve/Hold Policy

- **Purpose:** Apply a consistent publication policy from reviewer output.
- **Responsibilities:** Thresholds (`score ≥ 4` AND `not pii_detected` → auto-approve;
  otherwise hold), reason codes, override for human review, re-review on regeneration.
- **Inputs → Outputs:** Reviewer verdict → `auto_approved | held` with reasons.
- **Dependencies:** `C-AG-06`
- **Phase:** P4
- **Acceptance Signals:** Policy unit-tested at boundaries (score 3.9 vs 4.0); every hold has
  a human-actionable reason.
- **Risks / Open Questions:** Threshold calibration against real outputs.

---

### `C-TRUST-03` Human-in-the-Loop 1-Tap Consent & Publication Gate

- **Purpose:** The senior is the final gatekeeper and owns their story.
- **Responsibilities:** Present generated media for review; capture 1-tap approve/reject;
  enforce preview-before-publish; revoke/withdraw; record consent timestamp.
- **Inputs → Outputs:** Generated media → approved (publishable) | rejected/withdrawn.
- **Dependencies:** `C-FE-02`, `C-BE-05`
- **Phase:** P4
- **Acceptance Signals:** No story publishes without an explicit senior approval record;
  withdrawal unpublishes immediately.
- **Risks / Open Questions:** Comprehension of what is being approved; seniors without
  devices (phone/assisted review).

---

### `C-TRUST-04` Real-Time Safety Moderation & Interception

- **Purpose:** Stop scams, phishing and abuse in 1-on-1 messaging before delivery.
- **Responsibilities:** Synchronous scan, hard-block, reason surfacing, audit logging,
  detection-rate and Time-to-Verdict instrumentation.
- **Inputs → Outputs:** Message → allow | block(reason) | escalate.
- **Dependencies:** `C-AG-07`
- **Phase:** P4
- **Acceptance Signals:** `wire transfer`, `bank account`, `SSN`, `Venno` test messages
  blocked pre-delivery; metrics logged.
- **Risks / Open Questions:** Obfuscated scams; false positives; latency budget.

---

### `C-TRUST-05` PII Detection & Redaction

- **Purpose:** Keep personal data out of generated media and messages.
- **Responsibilities:** Detect names/addresses/phones/SSNs/bank details; redact or mask with
  `[redacted]`; flag for human review; never forward PII across users.
- **Dependencies:** `C-INT-01`, `C-INT-03`
- **Phase:** P4
- **Acceptance Signals:** PII test corpus is detected and redacted; redaction events logged;
  reviewer blocks outputs containing unreviewed PII.
- **Risks / Open Questions:** False negatives on unusual formats; preserving story meaning.

---

### `C-TRUST-06` Failure Handling & Strict Publication Block

- **Purpose:** Fail safe — never publish because a step silently failed.
- **Responsibilities:** Block publication when review is missing/failed, approval absent,
  grounding low, PII present, or an agent errored; surface a retry/hold state.
- **Dependencies:** `C-BE-05`
- **Phase:** P4
- **Acceptance Signals:** Fault-injection tests never yield a published unsafe story; held
  stories are visible to the senior/admin with a retry path.
- **Risks / Open Questions:** Recovery UX; preventing permanent stuck states.

---

### `C-TRUST-07` Crisis Escalation & Helpline Routing

- **Purpose:** Route mental-health/crisis disclosures to human help.
- **Responsibilities:** Detect self-harm/crisis/abuse disclosures during moderation;
  respond with supportive messaging and route to 988 / ElderCare / local helplines; notify
  a human moderator.
- **Dependencies:** `C-AG-07`
- **Phase:** P4
- **Acceptance Signals:** Crisis test triggers escalation, not a generic block; helpline
  resource surfaced; human notification logged.
- **Risks / Open Questions:** Legal/safety best practice; staffing the human side.

---

### `C-TRUST-08` Data Ownership & Visibility Controls

- **Purpose:** Give seniors full ownership and granular visibility of their stories.
- **Responsibilities:** Visibility levels (Public Library, Youth-Community Only, Verified
  Penpals Only, Private Family Only), consent per story, export/delete, trace of who saw what.
- **Dependencies:** `C-DATA-04`
- **Phase:** P4
- **Acceptance Signals:** Changing visibility immediately changes feed availability; delete
  removes content and assets; consent is required before any publish.
- **Risks / Open Questions:** Family access vs. senior autonomy; retention of deleted data.

---

### `C-TRUST-09` Trust & Robustness Evaluation Harness

- **Purpose:** Measure and evidence the trust claims for judges.
- **Responsibilities:** Runnable test cases: noisy memo → categorization + 3 formats;
  follow-up matching ≥2 shared interests; safety stress test blocking financial scam; metrics
  for **Real-Time Interception Efficacy** (Time-to-Verdict + detection rate), grounding
  score distribution, pipeline latency; produce result table for `C-DEL-03`.
- **Dependencies:** `C-AG-06/07`, `C-DATA-05`
- **Phase:** P5
- **Acceptance Signals:** Harness runs with one command; produces the expected/actual/
  behaviors/limitations matrix; consistently detects the scripted scam.
- **Risks / Open Questions:** Small sample size; live-vs-recorded demo reliability.

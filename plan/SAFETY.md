# HistorAI — Content Safety Plan

> Status: **implemented.** Companion to [`ROADMAP.md`](./ROADMAP.md),
> [`PROFILES.md`](./PROFILES.md) and [`../MVP.md`](../MVP.md).
> Scope: a safety gate for every user-facing published artifact — generated story
> **articles**, youth **questions**, and public profile **bios**.
> Goal: nothing goes on the page unless it is **family-friendly, non-graphic, and
> non-instructional**, while still allowing real-life difficult topics (war, illness,
> loss) to be told honestly.

---

## 1. Confirmed decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Generated story articles, youth questions, public profile bios |
| 2 | Hard violation | **Cannot be published.** Only a drastic rewrite/removal of the offending content can clear it. No "publish anyway". |
| 3 | Profanity | Mild words ("damn", "hell", etc.) are a **soft** issue. War/illness/difficult real-life topics are allowed if non-graphic and non-instructional. |
| 4 | Call order | **Safety agent runs first.** If it does not pass, the grounding review agent is **not** called; the user is asked to change the content. |
| 5 | Legacy / demo data | `safety` is **nullable**; a missing value means allowed, so the fallback/demo story keeps working (preserves `MVP.md` AC-5). |
| 6 | Language | **English only** for now. |
| 7 | Model | Reuse `config.llmModel` (`lib/config.ts`). No new env var. |
| 8 | Auto revision | Used to remove/sanitize **soft** issues automatically. |

### Interpretation note (assumption to confirm)

Decisions 2, 4 and 8 are combined as follows:

- **Soft** issue (profanity, crude language) → the pipeline automatically re-creates the
  article once with the safety feedback, then checks safety again.
- **Hard** issue (crime instructions, graphic content, etc.) → the pipeline **stops**:
  no review agent, nothing publishable. The user must either provide new information or
  explicitly ask us to "re-create without that part" (which runs the revision agent).

If auto-revision should instead run silently for hard issues too, only the orchestration
in §5.1 changes; the data model and gate stay the same.

---

## 2. Policy

Two severities drive everything. The verdict is always **derived server-side from
severities**, never trusted from the model (same pattern as the current review verdict).

| Severity | Meaning | Verdict | Publishable? |
|----------|---------|---------|--------------|
| `soft` | Family-friendly polish: profanity, crude language, mildly crude phrasing. | `revise` | Yes, after auto-revision; senior may still override a failed review. |
| `hard` | Instructions/encouragement for crime, incitement to violence, hate, sexual content (esp. minors), self-harm instructions, graphic violence/gore, doxxing/PII of others, scams/phishing. | `block` | **Never.** No override path. |
| — | Nothing flagged. | `allow` | Yes. |

**Allowed even when difficult:** war, illness, death, poverty, discrimination, crime the
person witnessed or experienced — as long as the writing is **non-graphic** and does not
**instruct or encourage**. The prompt must explicitly distinguish *depicting* from
*instructing/promoting*.

---

## 3. Data model (`lib/types.ts`)

Add alongside the existing `ReviewResult`:

```ts
export type SafetyCategory =
  | "profanity" | "sexual" | "violence" | "hate" | "harassment"
  | "self_harm" | "illegal_instructions" | "graphic" | "pii" | "other";

export type SafetySeverity = "soft" | "hard";
export type SafetyVerdict = "allow" | "revise" | "block";

export interface SafetyIssue {
  category: SafetyCategory;
  severity: SafetySeverity;
  detail: string;
  excerpt?: string;
}

export interface SafetyResult {
  verdict: SafetyVerdict;
  issues: SafetyIssue[];
  summary: string;      // written to the user, plain language
  createdAt: string;
}
```

`Story` gains:

```jsonc
"safety": SafetyResult | null   // null = not checked (legacy/demo) → allowed
```

- `lib/store.ts` `createStory()` defaults `safety: input.safety ?? null`.
- `lib/store.ts` `normalizeStory()` defaults `safety: story.safety ?? null` so existing
  rows (including the committed fallback) load unchanged.
- Optional: when a `pii` issue is found, also set the already-present
  `piiDetected` field to `true`.

Questions and bios are gated at write time and are **not** required to persist a
`SafetyResult` for this iteration (see §5.3 / §5.4).

---

## 4. Safety agent

### 4.1 New prompt: `prompts/safety_agent.md`

One file, matching the existing `prompts/*.md` convention. It receives:

- the **content to judge** (article / question / bio), and
- optional **context** — for articles, the original transcript, labeled *"context only,
  do not judge this; use it only to tell a faithful depiction from an instruction."*

It must:

- classify each problem with a `category` and `severity`;
- quote the exact offending text in `excerpt`;
- explain in `detail` what is wrong and how to fix it (remove / soften / cut out);
- explicitly allow non-graphic, non-instructional difficult topics;
- reply with **only** compact JSON:

```json
{"verdict":"allow","summary":"...","issues":[{"category":"profanity","severity":"soft","detail":"...","excerpt":"..."}]}
```

The model's `verdict` is advisory; the server recomputes it.

### 4.2 `lib/prompts.ts`

Add `"safety_agent"` to the `PromptName` union.

### 4.3 `checkSafety()` in `lib/agents.ts`

```
checkSafety({ content, kind, context? }) → Promise<SafetyResult>
```

- Loads `safety_agent`, calls `chat(...)` with `config.llmModel`, `temperature: 0`,
  and a new `SAFETY_TIMEOUT_MS` (≈ 30 s).
- Reuses the existing `parseJsonObject` / `asString` helpers.
- Validates `category` against the allowed list and `severity` against `soft | hard`;
  drops malformed issues.
- Derives the verdict:
  - any `hard` → `block`
  - else any `soft` → `revise`
  - else `allow`
- **Fail closed:** on timeout / HTTP error / unparseable output it throws; the caller
  must not persist anything publishable.

### 4.4 Auto-revision

Extend `reviseArticle()` to accept an optional `safety: SafetyResult | null` and include
its issues in the user message under a `SAFETY FEEDBACK` block. Update
`prompts/revision_agent.md` with a short section: remove or rewrite flagged content,
never reproduce profanity, never add anything, keep the rest faithful. This is the
"cut it out / recreate" action used for both automatic soft cleanup and the user-triggered
hard-issue rewrite.

---

## 5. Enforcement

### 5.1 Story pipeline — `app/api/generate/route.ts` (`runPipeline`)

Replace the current `write → review` sequence with **safety first**:

```
write / revise draft
        │
        ▼
  checkSafety(draft.article, context=transcript)
        │
   ┌────┼─────────────────────────────┐
   ▼    ▼                             ▼
 allow  revise (soft)                block (hard)
   │    │ auto-revise once               │
   │    ▼ with safety issues            │
   │  checkSafety() again               │
   │    ├─ allow  → review             │
   │    └─ else   → surface, stop      │
   │                                    │
   ▼                                    ▼
reviewArticle()                    STOP — review NOT called
   │                                persist draft + safety
   ▼
persist review + safety
status = "reviewed" only if safety.allow AND review.pass
```

- Cap the auto-revision loop at **one** pass.
- If safety ends in `block`/`revise`, still persist the draft and its `safety` result so
  the senior sees exactly what to fix.
- If `checkSafety` throws, return an error (existing `502` for OpenRouter failures) and
  persist nothing publishable.

### 5.2 Publish gate — `app/api/approve/route.ts`

- `story.safety?.verdict === "block"` → `409`, **never** publish, even with
  `override: true`. Message tells the user to re-create without the flagged part.
- `story.safety?.verdict === "revise"` → treated like a failed grounding review:
  publishable only with `override: true`.
- `story.safety === null` (legacy/demo) → allowed (decision 5).
- `safety === "allow"` and `review.pass` → publish as today.

### 5.3 Questions — `app/api/questions/route.ts`

Run `checkSafety({ content: text, kind: "question" })` **before** `createQuestion`:

- `allow` → save (unchanged).
- `revise` (soft) → auto-revise the text, re-check, then save the sanitized question and
  return it with a notice. (If the revised text no longer reads as the same question,
  return `422` and ask the Drop to rephrase instead.)
- `block` → `422`, save nothing, return the safety `summary` so
  `components/ask-question-form.tsx` shows "please ask something different".

No review agent is called for questions.

### 5.4 Profile fields — `app/api/auth/profile/route.ts`

When `body.bio` is present, run `checkSafety({ content: bio, kind: "bio" })`:

- `allow` → save.
- `revise` → auto-revise, re-check, save the sanitized bio, return it.
- `block` → `422`, do not update, return the safety `summary` so
  `components/profile-form.tsx` shows the reason.

When `body.name` is present, run `checkSafety({ content: name, kind: "name" })`:

- `allow` → save.
- Anything else (`revise` or `block`) → `422`, do not update, return the safety
  `summary`. A name is not auto-revised: a display name is public and shortening or
  cleaning it would silently change the person's identity.

The same name gate runs in `app/api/auth/login/route.ts` before `createUser`, so a
display name cannot be created with harmful content in the first place.

### 5.5 Feed defense-in-depth (optional)

`lib/answers.ts` `getPublishedStories()` may additionally drop any story whose
`safety?.verdict === "block"`. Since a block can never be published this should never
match, but it is cheap insurance.

---

## 6. UI changes

- **`app/senior/review/[id]/page.tsx`** — add a "Safety check" panel next to "Editor
  review": verdict badge + issues (category, severity, excerpt, fix).
- **`components/review-actions.tsx`**
  - `safety === "block"`: hide/disable "Publish anyway"; show a clear explanation and a
    **"Re-create without the flagged part"** action (calls `/api/generate`, which runs
    the safety-first pipeline again) plus a link to change the answer.
  - `safety === "revise"`: show the issues; keep the existing override flow.
  - When the current story was auto-revised for safety, show a short notice.
- **`components/ask-question-form.tsx`** / **`components/profile-form.tsx`** — surface the
  `422` safety message (reuse the existing `error`/`notice` patterns).

---

## 7. Build order

| Step | Outcome | Touches |
|------|---------|---------|
| S1 | Types + prompt name + safety prompt | `lib/types.ts`, `lib/prompts.ts`, `prompts/safety_agent.md` |
| S2 | `checkSafety()` + `reviseArticle` safety input | `lib/agents.ts`, `prompts/revision_agent.md` |
| S3 | Safety-first story pipeline + persist + approve gate | `app/api/generate/route.ts`, `app/api/approve/route.ts`, `lib/store.ts` |
| S4 | Review UI: safety panel, block/revise states, re-create action | `app/senior/review/[id]/page.tsx`, `components/review-actions.tsx` |
| S5 | Questions gate | `app/api/questions/route.ts`, `components/ask-question-form.tsx` |
| S6 | Profile bio + display-name gate | `app/api/auth/profile/route.ts`, `app/api/auth/login/route.ts`, `components/profile-form.tsx` |
| S7 | Legacy defaults (+ optional backfill script) | `lib/store.ts`, `scripts/` |
| S8 | Manual test cases + demo rehearsal | tests / docs |

---

## 8. Acceptance criteria

- **AC-S1** — An article containing step-by-step instructions for a crime gets
  `safety.verdict = "block"`, the review agent is **not** called, and it cannot be
  published even with `override: true`.
- **AC-S2** — An article containing "damn"/"hell" gets a `soft` issue; it is auto-revised,
  re-checked, and then goes through the normal grounding review.
- **AC-S3** — A non-graphic, non-instructional story about war or illness passes safety.
- **AC-S4** — A question or bio with hard content is rejected (`422`) and not saved; a
  soft one is sanitized or rephrased.
- **AC-S5** — Legacy/demo stories with `safety: null` still load and publish (MVP AC-5
  preserved).
- **AC-S6** — A safety-agent timeout/failure fails closed: nothing publishable is created.
- **AC-S7** — English-only detection is documented in the prompt and this plan.
- **AC-S8** — A display name containing a slur, sexual content, threat, or other harmful
  content is rejected (`422`) at signup and on profile edit; ordinary names, including
  real names that match crude words, are accepted.

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| False positives on oral-history content | Prompt distinguishes depiction from instruction; soft tier; user can rephrase or re-create |
| False positives on a real name | Prompt allows ordinary given names/surnames that match crude words; a rejected user is asked to choose another name |
| Auto-revision loop / latency | Cap at one pass; safety runs before review so failures skip the review call |
| Silently rewriting a Drop's question or a bio | Soft sanitize returns the new text; hard always rejects |
| Legacy rows fail open | Accepted for the demo; optional backfill script |
| Extra LLM call cost/latency | Reuses `config.llmModel`; short timeout; skipped entirely when safety blocks |
| Non-English content | Explicitly out of scope; English-only prompt for now |

---

## 10. Out of scope (deferred)

- Non-English moderation.
- Dedicated moderation model or provider endpoint.
- Admin/moderator review queue and override tooling.
- Backfill of historical articles (optional script only).
- Checking `interests` and other profile fields.
- Re-running safety on already-published legacy stories.

---

## 11. Implementation notes

Shipped in `lib/types.ts`, `lib/agents.ts`, `lib/prompts.ts`, `lib/store.ts`,
`lib/answers.ts`, `app/api/generate/route.ts`, `app/api/approve/route.ts`,
`app/api/questions/route.ts`, `app/api/auth/profile/route.ts`,
`app/senior/review/[id]/page.tsx`, `components/review-actions.tsx`,
`components/ask-question-form.tsx`, `components/profile-form.tsx`, and the prompts
`safety_agent.md`, `safety_rewrite_agent.md`, `revision_agent.md`.

- Soft question/bio cleanup uses a dedicated `safety_rewrite_agent` prompt and
  `rewriteForSafety()` rather than the article revision agent (which expects a transcript).
- The "question/bio was auto-cleaned" path returns the cleaned text plus a short `notice`
  shown by the forms; semantic-equivalence detection (plan §5.3 parenthetical) is
  approximated by re-running safety on the cleaned text.
- The optional "auto-revised for safety" banner in the review UI (plan §6) was not added,
  because it would require persisting an extra flag; the Safety check panel already shows
  the current verdict and issues.
- Type-check (`tsc --noEmit`) and `next build` both pass.

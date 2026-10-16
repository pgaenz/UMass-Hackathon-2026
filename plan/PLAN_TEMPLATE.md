# Plan Template

Copy this structure for every new plan file: `/plan/<plan-id>-<slug>.md`.
Keep section headings stable so plans are comparable and scriptable.

---

```markdown
# <PLAN-ID> — <Plan Title>

| Field | Value |
|-------|-------|
| **Plan ID** | P-0XX |
| **Phase** | P1 / P2 / P3 / P4 / P5 / B |
| **Owner** | Dev A / Dev B / Both / Business |
| **Component IDs** | C-XX-YY, ... |
| **Depends on** | P-0XX, ... |
| **Status** | ⬜ not started / 🟡 in progress / ⛔ blocked / 🔵 in review / ✅ done / ➖ deferred |
| **Est. effort** | X h |

## 1. Goal
One or two sentences: the outcome this plan produces and why it matters.

## 2. Scope
**In scope**
- ...

**Out of scope**
- ...

## 3. Prerequisites
- [ ] Dependency plan done
- [ ] Env / API keys available
- [ ] Decision recorded (ADR) if needed

## 4. Deliverables
- [ ] Concrete artifact 1 (file/service/doc/asset)
- [ ] Concrete artifact 2

## 5. To-Dos
- [ ] Task ...
- [ ] Task ...
- [ ] Task ...

## 6. Acceptance Criteria
Each criterion must be objectively checkable. Prefer Given/When/Then.

1. **AC-1** — Given ..., when ..., then ....
2. **AC-2** — ...
3. **AC-3** — ...

## 7. Verification / Evidence
- [ ] Test name / command / manual step
- [ ] Evidence link (screenshot, log, metric, test report)

## 8. Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ... | M | H | ... |

## 9. Notes / Decisions
- Link ADRs, open questions, follow-ups.
```

---

## Writing guidance

- **To-Dos** are small (≤2 h each) and start with a verb.
- **Acceptance criteria** describe observable behavior, not implementation.
- If a plan depends on an external decision, mark it ⛔ blocked and record the question.
- Never mark ✅ without at least one piece of evidence in section 7.

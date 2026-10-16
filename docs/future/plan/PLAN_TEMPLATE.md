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
| **Test framework** | Vitest / Playwright / pytest / manual (justify) |

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
- [ ] Concrete artifact 1 (test file / service / doc / asset)
- [ ] Concrete artifact 2

## 5. To-Dos (Red → Green → Refactor)
Work each acceptance criterion through the TDD loop. Within a cycle the order is
**mandatory**: a test must be seen failing (Red) before any implementation (Green),
and all tests must be green before refactoring. Keep each step ≤ 2 h and start with a verb.

### Cycle 1 — AC-1
- [ ] **Red:** Add failing test `<file>::<test name>` asserting `<behavior>`; run it and paste the failure.
- [ ] **Green:** Write the minimum code to make that test pass; run it and paste the pass.
- [ ] **Refactor:** Clean up without changing behavior; full suite still green.

### Cycle 2 — AC-2
- [ ] **Red:** ...
- [ ] **Green:** ...
- [ ] **Refactor:** ...

## 6. Acceptance Criteria
Each criterion must be objectively checkable **and backed by a test** (automated where
possible). Prefer Given/When/Then. Every AC maps to the TDD cycle of the same number.

1. **AC-1** — Given ..., when ..., then ....
   - Test: `<file>::<test name>` · Mode: automated / manual (justify)
2. **AC-2** — ...
   - Test: `<file>::<test name>` · Mode: automated / manual (justify)
3. **AC-3** — ...

## 7. Verification / Evidence
- [ ] **Red evidence:** failing-test output/log for each AC (captured before Green)
- [ ] **Green evidence:** passing test run (`<command>`) for each AC
- [ ] Coverage / quality gate result (if applicable)
- [ ] Evidence link (screenshot, log, metric, test report) for any manual AC

## 8. Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ... | M | H | ... |

## 9. Notes / Decisions
- Link ADRs, open questions, follow-ups.
```

---

## Writing guidance

- **To-Dos** follow the **Red → Green → Refactor** loop and are small (≤ 2 h each).
- **Never write implementation before a failing test exists.** A Green task may not be
  checked until its Red task has been observed failing and the failure captured.
- **Acceptance criteria** describe observable behavior, not implementation, and each one
  must name the test that proves it (or justify why it is manual).
- If a plan depends on an external decision, mark it ⛔ blocked and record the question.
- Never mark ✅ without Green evidence (and Red evidence) in section 7.

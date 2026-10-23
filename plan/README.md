# HistorAI — MVP Plan Tracker

The **single build plan** is [`../MVP.md`](../MVP.md). This file only tracks progress.

> Keep this short. If a milestone needs detail, add it to `MVP.md`, not here.

## Status legend

| Symbol | Meaning |
|--------|---------|
| ⬜ | not started |
| 🟡 | in progress |
| ⛔ | blocked |
| ✅ | done |

## Milestones

| # | Milestone | Phase | Owner | Status |
|---|-----------|-------|-------|--------|
| M1 | Foundation ready — app runs, routes exist, store works | P1 | Both | ✅ |
| M2 | Input → transcript works (voice + typed) | P2 | A: AI, B: UI | 🟡 |
| M3 | Transcript → article + grounding score | P3 | A | ⬜ |
| M4 | Approve → published → appears in youth feed | P3 | Both | ⬜ |
| M5 | Demo-ready with fallback and a rehearsal | P5 | Both | ⬜ |

Owners: **A** = AI/backend routes, **B** = UI. 2 people × 15 h = 30 h.

## Companion plans

- [`PROFILES.md`](./PROFILES.md) — login, roles, profiles, ownership.
- [`SAFETY.md`](./SAFETY.md) — content safety gate for articles, questions, and bios.
- [`CHAT.md`](./CHAT.md) — 1:1 messaging (Rivers ↔ anyone, Drops ↔ Rivers), discovery, unread state, and pre-send safety screening.
- [`LIKES.md`](./LIKES.md) — per-user story likes and the interest-based "someone else liked this" match pop-up.
- [`UX-FIXES.md`](./UX-FIXES.md) — cursor above modal dialogs, answer sorting/filtering, answer likes on the question thread, and question linkage.
- [`UX-FIXES-2.md`](./UX-FIXES-2.md) — search, global quick links, per-user question votes, and returning-user sign-in.

## Definition of Done (MVP)

1. The demo loop in `MVP.md` runs end to end with real audio.
2. A fabricated-fact test is caught by the grounding check.
3. One command starts the app locally.
4. The fallback story serves the full loop if an API call fails.
5. `README.md` explains how to run it.
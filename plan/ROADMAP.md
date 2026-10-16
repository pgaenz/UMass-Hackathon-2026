# HistorAI — 30-Hour MVP Roadmap

2 people × 15 hours. One Next.js app. One demo loop. No database.

See [`../MVP.md`](../MVP.md) for the full component list and acceptance criteria.

---

## Hour budget

| Phase | Focus | Person-hours | Owner |
|-------|-------|--------------|-------|
| **P1** | Foundation: project, routes, JSON store, `.env` | 4 | Both |
| **P2** | Input → transcript (voice + typed) | 6 | A: AI/API · B: UI |
| **P3** | Article + grounding + approve + feed | 8 | A: AI/API · B: UI |
| **P4** | Integration & error states | 6 | Both |
| **P5** | Fallback, polish, demo rehearsal | 6 | Both |
| **Total** | | **30** | |

---

## Day-by-day (suggested)

| Day | Person A (AI / API routes) | Person B (UI) |
|-----|----------------------------|---------------|
| **Day 1** | Scaffold Next.js, JSON store, `.env` | `/senior` + `/youth` shells, accessibility basics |
| **Day 2** | `/api/intake` + Whisper transcription | Record button + text box, upload flow |
| **Day 3** | `/api/generate` article + grounding review | Article preview + approve UI |
| **Day 4** | Approve/publish endpoint, persistence | Youth feed + article render |
| **Day 5** | Wire end-to-end, fix errors | Error/empty/loading states |
| **Day 6** | Fallback story + demo assets | Demo polish, script the walkthrough |
| **Day 7** | Final bug pass | Rehearse live demo, write README run steps |

---

## Critical path

P1 → P2 (transcribe) → P3 (generate + review) → approve → feed → P5 (fallback).

If time runs short, cut in this order:
1. Text input (keep voice only) — but it is cheap, so usually keep it.
2. Metadata extraction beyond a simple topic tag.
3. Accessibility polish beyond large type/high contrast.
4. **Never cut the grounding check or the fallback.**

## Golden KPI

1 voice memo or text → 1 published article in **under 60 seconds**, and **0** fabricated facts
in the published output.
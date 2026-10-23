# HistorAI evaluation — live

Generated: 2026-10-23T04:16:45.474Z  
Started: 2026-10-23T04:16:19.858Z

**Summary:** 8 passed · 0 failed · 0 skipped · 8 total

- **Node:** v22.23.3
- **Network:** OpenRouter (real model calls)

| ID | Case | Expected | Actual | Status | Latency |
|----|------|----------|--------|--------|---------|
| LIVE-WRITE-01 | writing agent: transcript → article + topic + summary | non-empty Markdown article with a title and topic | topic="First Job", 295 chars | pass | 2151 ms |
| LIVE-REVIEW-01 | review agent: faithful article passes | verdict pass, score ≥ 4 | verdict pass, score 5, 0 issue(s) | pass | 4715 ms |
| LIVE-FABRICATED-01 | review agent catches an invented fact | verdict revise with ≥1 invented_fact issue | verdict revise, score 2, 2 invented_fact issue(s) | pass | 8495 ms |
| LIVE-DISTORTION-01 | review agent catches a removed hedge (distortion) | verdict revise with ≥1 distortion issue | verdict revise, score 3, 1 distortion issue(s) | pass | 4584 ms |
| LIVE-SAFETY-SOFT-01 | safety agent: mild profanity is soft (revise, not block) | verdict revise, soft issues only | verdict revise, soft/profanity | pass | 1335 ms |
| LIVE-SAFETY-HARD-01 | safety agent: scam instructions hard-block | verdict block with ≥1 hard issue | verdict block, 1 hard issue(s) | pass | 1836 ms |
| LIVE-CHAT-BLOCK-01 | chat semantic screen blocks a subtle scam (no regex match) | verdict block | verdict block, flags [scam:money] | pass | 886 ms |
| LIVE-CHAT-ALLOW-01 | chat semantic screen allows an ordinary message | verdict allow | verdict allow, flags [] | pass | 1601 ms |

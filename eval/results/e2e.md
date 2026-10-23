# HistorAI evaluation — e2e (black-box HTTP)

Generated: 2026-10-23T04:21:22.462Z  
Base URL: http://localhost:3000

**Summary:** 23 passed · 0 failed · 1 known issue(s) · 0 skipped · 24 total

Known issues are documented limitations reproduced by the harness, not undiagnosed regressions.


| ID | Case | Expected | Actual | Status | Latency |
|----|------|----------|--------|--------|---------|
| E2E-AGE-01 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age 12","age":12} | 400 (invalid profile) | 400 Please enter a valid age (13 or older). | pass | 22 ms |
| E2E-AGE-02 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age 121","age":121} | 400 (invalid profile) | 400 Please enter a valid age (13 or older). | pass | 13 ms |
| E2E-AGE-03 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age Fraction","age":13.5} | 400 (invalid profile) | 400 Please enter a valid age (13 or older). | pass | 13 ms |
| E2E-AGE-04 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age Text","age":"abc"} | 400 (invalid profile) | 400 Please enter a valid age (13 or older). | pass | 16 ms |
| E2E-AGE-05 | POST /api/auth/login rejects {"role":"drop","age":30} | 400 (invalid profile) | 400 Please enter your name. | pass | 12 ms |
| E2E-AGE-06 | POST /api/auth/login rejects {"role":"adult","name":"Eval Age Role","age":30} | 400 (invalid profile) | 400 Choose whether you are a River or a Drop. | pass | 14 ms |
| E2E-AGE-07 | POST /api/auth/login accepts age 13 and returns only the age band | 201, ageBand 13-17, no `age` field | 201, ageBand=13-17 | pass | 1247 ms |
| E2E-AGE-08 | benign name containing the product term "Drop" is accepted (known false positive) | 201 (benign name accepted) | 422 Please choose a different name, as this one may imply harmful or dangerous behavior. | known | 2337 ms |
| E2E-GATE-01 | a hard-blocked story cannot be published, even with override | 409 | 409 This story contains something that cannot be published. Re-create it without the flagged part, or change your answer. | pass | 20 ms |
| E2E-GATE-02 | a story that failed the review needs explicit confirmation | 409 without override | 409 The review flagged this story. Confirm you want to publish it anyway. | pass | 25 ms |
| E2E-GATE-03 | the River can still publish after a flagged review | 200, status published | 200, status published | pass | 21 ms |
| E2E-GATE-04 | a draft without an article cannot be approved | 409 | 409 There is no article to publish yet | pass | 27 ms |
| E2E-PIPE-01 | POST /api/intake stores the answer as a draft | 201, status draft, transcript echoed | 201, status draft, transcript match | pass | 31 ms |
| E2E-PIPE-02 | POST /api/generate produces an article plus safety and review verdicts | 200, non-empty article, safety verdict present | 200, 174 chars, safety=allow, review=pass | pass | 5155 ms |
| E2E-PIPE-03 | an unpublished story does not appear in /youth | marker absent from the rendered feed | 200, marker absent | pass | — |
| E2E-PIPE-04 | the River approves the story (override only when the review flagged it) | 200, status published | 200, status published | pass | 17 ms |
| E2E-PIPE-05 | the approved story appears in /youth | marker present in the rendered feed | 200, marker present | pass | — |
| E2E-LIKE-01 | liking a story returns a match when someone else liked it too | 200, liked, match with a user | 200, liked=true, match=lknl | pass | 47 ms |
| E2E-CHAT-00 | POST /api/chat/threads opens (or reopens) a 1:1 thread | 200/201 with a thread id | 200, thread t-seed-maya-ruth | pass | 19 ms |
| E2E-CHAT-01 | an ordinary message is delivered | 201 | 201 | pass | 1520 ms |
| E2E-CHAT-02 | blocked before delivery: "Call me at 617-555-1234.…" | 422 with pii:phone | 422 flags [pii:phone] | pass | 41 ms |
| E2E-CHAT-03 | blocked before delivery: "Please send money by gift card.…" | 422 with scam:money | 422 flags [scam:money] | pass | 21 ms |
| E2E-CHAT-04 | blocked before delivery: "Hello my friend, I have a business idea that wil…" | 422 (semantic screen) | 422 flags [scam:money] | pass | 921 ms |
| E2E-CHAT-05 | crisis language is intercepted with the 988 resource message | 422 with crisis=true | 422, crisis=true | pass | 44 ms |

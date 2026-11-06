# HistorAI evaluation — e2e (black-box HTTP)

Generated: 2026-11-06T02:40:46.486Z  
Base URL: http://localhost:3001

**Summary:** 40 passed · 0 failed · 1 known issue(s) · 3 skipped · 44 total

Known issues are documented limitations reproduced by the harness, not undiagnosed regressions.


| ID | Case | Expected | Actual | Status | Latency |
|----|------|----------|--------|--------|---------|
| E2E-AGE-01 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age 12","age":12} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 28 ms |
| E2E-AGE-02 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age 121","age":121} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 14 ms |
| E2E-AGE-03 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age Fraction","age":13.5} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 14 ms |
| E2E-AGE-04 | POST /api/auth/login rejects {"role":"drop","name":"Eval Age Text","age":"abc"} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 15 ms |
| E2E-AGE-05 | POST /api/auth/login rejects {"role":"drop","age":30} | 400 (invalid profile) | 400 Please enter your name. | pass | 19 ms |
| E2E-AGE-06 | POST /api/auth/login rejects {"role":"adult","name":"Eval Age Role","age":30} | 400 (invalid profile) | 400 Choose whether you are a River or a Drop. | pass | 14 ms |
| E2E-AGE-07 | POST /api/auth/login accepts age 16 and returns only the age band | 201, ageBand 13-17, no `age` field | 201, ageBand=13-17 | pass | 844 ms |
| E2E-AGE-08 | benign name containing the product term "Drop" is accepted (known false positive) | 201 (benign name accepted) | 422 Please choose a different name, as this one may imply harmful behavior. | known | 1450 ms |
| E2E-GATE-01 | a hard-blocked story cannot be published, even with override | 409 | skipped | skip | — |
| E2E-GATE-02 | a story that failed the review needs explicit confirmation | 409 without override | 409 The review flagged this story. Confirm you want to publish it anyway. | pass | 55 ms |
| E2E-GATE-03 | the River can still publish after a flagged review | 200, status published | 200, status published | pass | 51 ms |
| E2E-GATE-04 | a draft without an article cannot be approved | 409 | 409 There is no article to publish yet | pass | 40 ms |
| E2E-PIPE-01 | POST /api/intake stores the answer as a draft | 201, status draft, transcript echoed | 201, status draft, transcript match | pass | 57 ms |
| E2E-PIPE-02 | POST /api/generate produces an article plus safety and review verdicts | 200, non-empty article, safety verdict present | 200, 174 chars, safety=allow, review=pass | pass | 5546 ms |
| E2E-PIPE-03 | an unpublished story does not appear in /youth | marker absent from the rendered feed | 200, marker absent | pass | — |
| E2E-PIPE-04 | the River approves the story (override only when the review flagged it) | 200, status published | 200, status published | pass | 48 ms |
| E2E-PIPE-05 | the approved story appears in /youth | marker present in the rendered feed | 200, marker present | pass | — |
| E2E-LIKE-01 | liking a story returns a match when someone else liked it too | 200, liked, match with a user | skipped | skip | — |
| E2E-CHAT-00 | POST /api/chat/threads opens (or reopens) a 1:1 thread | 200/201 with a thread id | 200, thread t-seed-maya-ruth | pass | 73 ms |
| E2E-CHAT-01 | an ordinary message is delivered | 201 | 201 | pass | 1180 ms |
| E2E-CHAT-02 | blocked before delivery: "Call me at 617-555-1234.…" | 422 with pii:phone | 422 flags [pii:phone] | pass | 93 ms |
| E2E-CHAT-03 | blocked before delivery: "Please send money by gift card.…" | 422 with scam:money | 422 flags [scam:money] | pass | 66 ms |
| E2E-CHAT-04 | blocked before delivery: "Hello my friend, I have a business idea that wil…" | 422 (semantic screen) | 422 flags [scam:money] | pass | 1317 ms |
| E2E-CHAT-05 | crisis language is intercepted with the 988 resource message | 422 with crisis=true | 422, crisis=true | pass | 104 ms |
| E2E-RIV-01 | PATCH /api/stories/s-first-job requires a session | 401 | 401 | pass | 113 ms |
| E2E-RIV-02 | DELETE /api/stories/s-first-job requires a session | 401 | 401 | pass | 48 ms |
| E2E-RIV-03 | POST /api/stories/s-first-job/check requires a session | 401 | 401 | pass | 98 ms |
| E2E-RIV-04 | POST /api/stories/s-first-job/unpublish requires a session | 401 | 401 | pass | 117 ms |
| E2E-RIV-05 | POST /api/stories/s-first-job/restore requires a session | 401 | 401 | pass | 134 ms |
| E2E-RIV-06 | another River cannot edit this story | 403 | 403 This story belongs to another River. | pass | 71 ms |
| E2E-RIV-07 | a null-author story is not publishable by a River | 403 | skipped | skip | — |
| E2E-RIV-08 | saving an answer makes a story with an empty article | 201, article empty | 201, article="" | pass | 57 ms |
| E2E-RIV-09 | a transcript-only edit leaves the article unchanged | 200, article still empty | 200, article="" | pass | 65 ms |
| E2E-RIV-10 | unpublish takes a story off Read stories | 200, status reviewed or draft | 200, status draft | pass | 88 ms |
| E2E-RIV-11 | delete removes the story, its likes, and its question links | 200, 0 likes, 0 question links | 200, 0 likes, 0 links | pass | 85 ms |
| E2E-DROP-01 | question edit and withdraw require a session | 401 and 401 | 401 and 401 | pass | — |
| E2E-DROP-02 | another Drop cannot edit this question | 403 | 403 | pass | — |
| E2E-DROP-03 | an unknown question returns 404 | 404 | 404 | pass | — |
| E2E-DROP-04 | withdraw removes the question and its votes | 200, 0 -> 0, not listed | 200, 0 -> 0, gone | pass | — |
| E2E-DROP-05 | edit and withdraw are refused once a story is linked | 409 and 409 | 409 and 409 | pass | — |
| E2E-DROP-06 | similar questions never include askedBy | 200, no askedBy | 200, clean | pass | — |
| E2E-DROP-07 | a River cannot start a thread with a Drop under 18 | 403 with a generic message | 403 You cannot start a conversation with this person. | pass | — |
| E2E-DROP-08 | a River can still start a thread with an adult Drop | 200 or 201 | 200 | pass | — |
| E2E-DROP-09 | a Drop under 18 can still message a River | 200 or 201 | 201 | pass | — |

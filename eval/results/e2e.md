# HistorAI evaluation — e2e (black-box HTTP)

Generated: 2026-11-06T19:01:25.849Z  
Base URL: http://localhost:3000

**Summary:** 62 passed · 0 failed · 1 known issue(s) · 3 skipped · 66 total

Known issues are documented limitations reproduced by the harness, not undiagnosed regressions.


| ID | Case | Expected | Actual | Status | Latency |
|----|------|----------|--------|--------|---------|
| E2E-AGE-01 | POST /api/auth/register rejects {"role":"drop","name":"Eval Age 12","age":12} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 779 ms |
| E2E-AGE-02 | POST /api/auth/register rejects {"role":"drop","name":"Eval Age 121","age":121} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 84 ms |
| E2E-AGE-03 | POST /api/auth/register rejects {"role":"drop","name":"Eval Age Fraction","age":13.5} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 68 ms |
| E2E-AGE-04 | POST /api/auth/register rejects {"role":"drop","name":"Eval Age Text","age":"abc"} | 400 (invalid profile) | 400 Please enter an age between 16 and 30. | pass | 81 ms |
| E2E-AGE-05 | POST /api/auth/register rejects {"role":"drop","age":30} | 400 (invalid profile) | 400 Please enter your name. | pass | 70 ms |
| E2E-AGE-06 | POST /api/auth/register rejects {"role":"adult","name":"Eval Age Role","age":30} | 400 (invalid profile) | 400 Choose whether you are a River or a Drop. | pass | 83 ms |
| E2E-AGE-07 | POST /api/auth/register accepts age 16 and returns only the age band | 201, ageBand 13-17, no `age` field | 201, ageBand=13-17 | pass | 1395 ms |
| E2E-AGE-08 | benign name containing the product term "Drop" is accepted (known false positive) | 201 (benign name accepted) | 422 Please choose a different name, as this one may imply harmful behavior. | known | 2094 ms |
| E2E-AUTH-01 | registration creates an account, signs in, and leaks no secrets | 201, user id, no email/passwordHash field | 201 | pass | 3208 ms |
| E2E-AUTH-02 | registration rejects a duplicate email | 409 | 409 | pass | 3644 ms |
| E2E-AUTH-03 | registration rejects a weak password | 400 | 400 Please use at least 8 characters. | pass | 67 ms |
| E2E-AUTH-04 | login rejects a wrong password with a generic message | 401 Invalid email or password. | 401 Invalid email or password. | pass | 129 ms |
| E2E-AUTH-05 | two devices sign in to the same account independently | 200 and 200 | 200 and 200 | pass | 130 ms |
| E2E-AUTH-06 | a protected route returns 401 without a session | 401 | 401 | pass | 871 ms |
| E2E-AUTH-07 | a protected route returns 403 for the wrong role | 403 | 403 | pass | 531 ms |
| E2E-AUTH-08 | logout revokes only the current session | 200 logout; A 401; B 200 | 200; A 401; B 200 | pass | 525 ms |
| E2E-AUTH-09 | the passwordless demo sign-in endpoint is gone | 404 | 404 | pass | 1235 ms |
| E2E-AUTH-10 | a bumped sessionVersion invalidates older sessions | 401 | 401 | pass | 96 ms |
| E2E-AUTH-11 | the lifecycle test account registers | 201 with a user id | 201, id=u-aa59aa45-08b4-481a-a274-c712ece835d5 | pass | 2168 ms |
| E2E-AUTH-12 | forgot password does not reveal whether an email exists | 200 {ok:true} for both | 200 {"ok":true} / 200 {"ok":true} | pass | 766 ms |
| E2E-AUTH-13 | a reset link rotates the password and works once | 200 reset; 200 new login; 401 old login; 400 reuse | 200; 200; 401; 400 | pass | 743 ms |
| E2E-AUTH-14 | a reset revokes sessions issued before it | 401 | 401 | pass | 88 ms |
| E2E-AUTH-15 | an email verification token is single-use and stamps the credential | 200 then 400; emailVerifiedAt set | 200; 400; verified=true | pass | 664 ms |
| E2E-AUTH-16 | a password change keeps the current device and revokes the rest | 200 change; current 200; stale 401; new-password login 200 | 200; 200; 401; 200 | pass | 821 ms |
| E2E-AUTH-17 | cross-origin state-changing requests are rejected | cross-origin 403; same-origin 200 | 403; 200 | pass | 32 ms |
| E2E-UI-01 | the sign-in page shows email, password, forgot-password, and visitor controls | 200 with Email, Password, Forgot password?, visitor option | 200; email=true; password=true; forgot=true; visitor=true | pass | 644 ms |
| E2E-UI-02 | the sign-in page no longer offers a passwordless account picker | no 'no password' or 'Choose your profile' copy | passwordless=false; picker=false | pass | 644 ms |
| E2E-UI-03 | the forgot-password page is reachable | 200 with the reset request form | 200; form=true | pass | 1513 ms |
| E2E-UI-04 | a reset link without a token is rejected in the UI | 200 with an invalid or expired message | 200; message=true | pass | 1311 ms |
| E2E-UI-05 | a verification link without a token is rejected in the UI | 200 with a missing-token message | 200; message=true | pass | 1298 ms |
| E2E-GATE-01 | a hard-blocked story cannot be published, even with override | 409 | skipped | skip | — |
| E2E-GATE-02 | a story that failed the review needs explicit confirmation | 409 without override | 409 The review flagged this story. Confirm you want to publish it anyway. | pass | 860 ms |
| E2E-GATE-03 | the River can still publish after a flagged review | 200, status published | 200, status published | pass | 98 ms |
| E2E-GATE-04 | a draft without an article cannot be approved | 409 | 409 There is no article to publish yet | pass | 79 ms |
| E2E-PIPE-01 | POST /api/intake stores the answer as a draft | 201, status draft, transcript echoed | 201, status draft, transcript match | pass | 117 ms |
| E2E-PIPE-02 | POST /api/generate produces an article plus safety and review verdicts | 200, non-empty article, safety verdict present | 200, 174 chars, safety=allow, review=pass | pass | 8875 ms |
| E2E-PIPE-03 | an unpublished story does not appear in /youth | marker absent from the rendered feed | 200, marker absent | pass | — |
| E2E-PIPE-04 | the River approves the story (override only when the review flagged it) | 200, status published | 200, status published | pass | 109 ms |
| E2E-PIPE-05 | the approved story appears in /youth | marker present in the rendered feed | 200, marker present | pass | — |
| E2E-LIKE-01 | liking a story returns a match when someone else liked it too | 200, liked, match with a user | skipped | skip | — |
| E2E-CHAT-00 | POST /api/chat/threads opens (or reopens) a 1:1 thread | 200/201 with a thread id | 200, thread t-seed-maya-ruth | pass | 1423 ms |
| E2E-CHAT-01 | an ordinary message is delivered | 201 | 201 | pass | 3715 ms |
| E2E-CHAT-02 | blocked before delivery: "Call me at 617-555-1234.…" | 422 with pii:phone | 422 flags [pii:phone] | pass | 162 ms |
| E2E-CHAT-03 | blocked before delivery: "Please send money by gift card.…" | 422 with scam:money | 422 flags [scam:money] | pass | 99 ms |
| E2E-CHAT-04 | blocked before delivery: "Hello my friend, I have a business idea that wil…" | 422 (semantic screen) | 422 flags [scam:money] | pass | 1383 ms |
| E2E-CHAT-05 | crisis language is intercepted with the 988 resource message | 422 with crisis=true | 422, crisis=true | pass | 149 ms |
| E2E-RIV-01 | PATCH /api/stories/s-first-job requires a session | 401 | 401 | pass | 2498 ms |
| E2E-RIV-02 | DELETE /api/stories/s-first-job requires a session | 401 | 401 | pass | 123 ms |
| E2E-RIV-03 | POST /api/stories/s-first-job/check requires a session | 401 | 401 | pass | 2362 ms |
| E2E-RIV-04 | POST /api/stories/s-first-job/unpublish requires a session | 401 | 401 | pass | 2223 ms |
| E2E-RIV-05 | POST /api/stories/s-first-job/restore requires a session | 401 | 401 | pass | 2323 ms |
| E2E-RIV-06 | another River cannot edit this story | 403 | 403 This story belongs to another River. | pass | 159 ms |
| E2E-RIV-07 | a null-author story is not publishable by a River | 403 | skipped | skip | — |
| E2E-RIV-08 | saving an answer makes a story with an empty article | 201, article empty | 201, article="" | pass | 111 ms |
| E2E-RIV-09 | a transcript-only edit leaves the article unchanged | 200, article still empty | 200, article="" | pass | 104 ms |
| E2E-RIV-10 | unpublish takes a story off Read stories | 200, status reviewed or draft | 200, status draft | pass | 156 ms |
| E2E-RIV-11 | delete removes the story, its likes, and its question links | 200, 0 likes, story gone | 200, 0 likes, gone | pass | 131 ms |
| E2E-DROP-01 | question edit and withdraw require a session | 401 and 401 | 401 and 401 | pass | — |
| E2E-DROP-02 | another Drop cannot edit this question | 403 | 403 | pass | — |
| E2E-DROP-03 | an unknown question returns 404 | 404 | 404 | pass | — |
| E2E-DROP-04 | withdraw removes the question and its votes | 200, 0 -> 0, not listed | 200, 0 -> 0, gone | pass | — |
| E2E-DROP-05 | edit and withdraw are refused once a story is linked | 409 and 409 | 409 and 409 | pass | — |
| E2E-DROP-06 | similar questions never include askedBy | 200, no askedBy | 200, clean | pass | — |
| E2E-DROP-07 | a River cannot start a thread with a Drop under 18 | 403 with a generic message | 403 You cannot start a conversation with this person. | pass | — |
| E2E-DROP-08 | a River can still start a thread with an adult Drop | 200 or 201 | 200 | pass | — |
| E2E-DROP-09 | a Drop under 18 can still message a River | 200 or 201 | 201 | pass | — |

# HistorAI evaluation — offline

Generated: 2026-11-06T02:44:11.109Z  
Started: 2026-11-06T02:44:11.088Z

**Summary:** 98 passed · 0 failed · 0 skipped · 98 total

- **Node:** v22.23.3
- **Network:** none (deterministic logic only)

| ID | Case | Expected | Actual | Status | Latency |
|----|------|----------|--------|--------|---------|
| REV-01 | review: score 5, no issues | pass | pass | pass | — |
| REV-02 | review: score 4, tone | pass | pass | pass | — |
| REV-03 | review: score 4, clarity | pass | pass | pass | — |
| REV-04 | review: score 4, invented_fact | revise | revise | pass | — |
| REV-05 | review: score 5, distortion | revise | revise | pass | — |
| REV-06 | review: score 3, no issues | revise | revise | pass | — |
| REV-07 | review: score 2, no issues | revise | revise | pass | — |
| REV-08 | review: score 1, no issues | revise | revise | pass | — |
| SAF-01 | safety: no issues | allow | allow | pass | — |
| SAF-02 | safety: soft/profanity | revise | revise | pass | — |
| SAF-03 | safety: soft/profanity+soft/other | revise | revise | pass | — |
| SAF-04 | safety: hard/illegal_instructions | block | block | pass | — |
| SAF-05 | safety: hard/pii | block | block | pass | — |
| SAF-06 | safety: soft/profanity+hard/violence | block | block | pass | — |
| SAF-07 | safety: hard/self_harm | block | block | pass | — |
| AGE-01 | age 12 (limits 13–120) | rejected | rejected | pass | — |
| AGE-02 | age 0 (limits 13–120) | rejected | rejected | pass | — |
| AGE-03 | age -5 (limits 13–120) | rejected | rejected | pass | — |
| AGE-04 | age 13 (limits 13–120) | accepted, band 13-17 | accepted, band 13-17 | pass | — |
| AGE-05 | age 17 (limits 13–120) | accepted, band 13-17 | accepted, band 13-17 | pass | — |
| AGE-06 | age 18 (limits 13–120) | accepted, band 18-29 | accepted, band 18-29 | pass | — |
| AGE-07 | age 29 (limits 13–120) | accepted, band 18-29 | accepted, band 18-29 | pass | — |
| AGE-08 | age 30 (limits 13–120) | accepted, band 30-44 | accepted, band 30-44 | pass | — |
| AGE-09 | age 44 (limits 13–120) | accepted, band 30-44 | accepted, band 30-44 | pass | — |
| AGE-10 | age 45 (limits 13–120) | accepted, band 45-59 | accepted, band 45-59 | pass | — |
| AGE-11 | age 59 (limits 13–120) | accepted, band 45-59 | accepted, band 45-59 | pass | — |
| AGE-12 | age 60 (limits 13–120) | accepted, band 60-74 | accepted, band 60-74 | pass | — |
| AGE-13 | age 74 (limits 13–120) | accepted, band 60-74 | accepted, band 60-74 | pass | — |
| AGE-14 | age 75 (limits 13–120) | accepted, band 75+ | accepted, band 75+ | pass | — |
| AGE-15 | age 120 (limits 13–120) | accepted, band 75+ | accepted, band 75+ | pass | — |
| AGE-16 | age 121 (limits 13–120) | rejected | rejected | pass | — |
| AGE-17 | age 13.5 (limits 13–120) | rejected | rejected | pass | — |
| AGE-18 | age NaN (limits 13–120) | rejected | rejected | pass | — |
| AGE-19 | public profile never exposes the exact age | ageBand 30-44, no `age` field | ageBand 30-44 | pass | — |
| CHAT-S01 | What was your first job, and how did you get it? | no flags | no flags | pass | — |
| CHAT-S02 | I loved growing up in Boston. The summers felt endless. | no flags | no flags | pass | — |
| CHAT-S03 | Your story reminded me of my grandmother's kitchen. | no flags | no flags | pass | — |
| CHAT-S04 | Would you like to talk about music sometime? | no flags | no flags | pass | — |
| CHAT-S05 | Thank you for sharing that. I will try to be braver. | no flags | no flags | pass | — |
| CHAT-S06 | I planted tomatoes this spring, but the squirrels won. | no flags | no flags | pass | — |
| CHAT-R01 | Please send money by gift card today. | scam:money | scam:money | pass | — |
| CHAT-R02 | You can wire transfer the funds to me. | scam:money | scam:money | pass | — |
| CHAT-R03 | You've won a prize! Claim your winnings now. | scam:money | scam:money | pass | — |
| CHAT-R04 | Buy bitcoin and I will double it. | scam:money | scam:money | pass | — |
| CHAT-R05 | There is a small processing fee. | scam:money | scam:money | pass | — |
| CHAT-R06 | What is your password? | scam:credential | scam:credential | pass | — |
| CHAT-R07 | Please confirm your identity for me. | scam:credential | scam:credential | pass | — |
| CHAT-R08 | Send me the one-time code. | scam:credential | scam:credential | pass | — |
| CHAT-R09 | Call me at 617-555-1234. | pii:phone | pii:phone | pass | — |
| CHAT-R10 | Reach me at arthur@example.com. | pii:email | pii:email | pass | — |
| CHAT-R11 | My SSN is 123-45-6789. | pii:ssn | pii:ssn | pass | — |
| CHAT-R12 | I live at 42 Main Street. | pii:address | pii:address | pass | — |
| CHAT-R13 | My routing number is on the check. | pii:bank | pii:bank | pass | — |
| CHAT-R14 | You are worthless and I hate you. | abuse | abuse | pass | — |
| CHAT-R15 | Shut up, nobody asked you. | abuse | abuse | pass | — |
| CHAT-R16 | I want to die. | crisis | crisis | pass | — |
| CHAT-R17 | I have been thinking about self-harm. | crisis | crisis | pass | — |
| CHAT-R18 | Don't tell your parents about us. | grooming | grooming | pass | — |
| CHAT-R19 | Send me a photo of yourself. | grooming | grooming | pass | — |
| CHAT-R20 | Check out https://example.com for details. | link | link | pass | — |
| CHAT-R21 | Visit www.example.com. | link | link | pass | — |
| RIV-01 | published story | published | published | pass | — |
| RIV-02 | saved answer without an article | answer_saved | answer_saved | pass | — |
| RIV-03 | hard safety block | blocked | blocked | pass | — |
| RIV-04 | checks pending | needs_check | needs_check | pass | — |
| RIV-05 | review needs changes | needs_changes | needs_changes | pass | — |
| RIV-06 | reviewed and passing | ready | ready | pass | — |
| RIV-07 | answer changed after writing | needs_check | needs_check | pass | — |
| RIV-08 | legacy record has no stored hash | ready | ready | pass | — |
| RIV-09 | changed-answer modifier flag | true | true | pass | — |
| RIV-10 | article title composition round-trip | My First Job | My First Job | pass | — |
| RIV-11 | upload path guard: data/uploads/answer.webm | true | true | pass | — |
| RIV-12 | upload path guard: data/uploads/../../etc/passwd | false | false | pass | — |
| RIV-13 | upload path guard: data/uploads/../secrets.json | false | false | pass | — |
| RIV-14 | upload path guard: /etc/passwd | false | false | pass | — |
| DROP-Q01 | question text length 7 | rejected | rejected | pass | — |
| DROP-Q02 | question text length 8 | accepted | accepted | pass | — |
| DROP-Q03 | question text length 300 | accepted | accepted | pass | — |
| DROP-Q04 | question text length 301 | rejected | rejected | pass | — |
| DROP-T01 | question topics ["job"] | accepted | accepted | pass | — |
| DROP-T02 | question topics ["unknown"] | rejected | rejected | pass | — |
| DROP-T03 | question topics ["job","family","a","b","c","d"] | rejected | rejected | pass | — |
| DROP-M01 | river (60) -> drop (16) | refused | refused | pass | — |
| DROP-M02 | river (60) -> drop (18) | allowed | allowed | pass | — |
| DROP-M03 | drop (17) -> river (60) | allowed | allowed | pass | — |
| DROP-M04 | river (60) -> river (65) | allowed | allowed | pass | — |
| DROP-M05 | drop (20) -> drop (20) | refused | refused | pass | — |
| DROP-N01 | public name "Maya Chen" | "Maya C." | "Maya C." | pass | — |
| DROP-N02 | public name "Maya" | "Maya" | "Maya" | pass | — |
| DROP-N03 | public name "   " | "" | "" | pass | — |
| DROP-N04 | public name "Liam O'Connor" | "Liam O." | "Liam O." | pass | — |
| DROP-S01 | question state (waiting) | waiting | waiting | pass | — |
| DROP-S02 | question state (in_progress) | in_progress | in_progress | pass | — |
| DROP-S03 | question state (answered) | answered | answered | pass | — |
| DROP-S04 | question state (waiting) | waiting | waiting | pass | — |
| DROP-S05 | edited modifier | true | true | pass | — |
| DROP-SIM01 | similar questions need 15 characters | 0 | 0 | pass | — |
| DROP-SIM02 | keyword overlap ranks the first-job question first | q-a | q-a | pass | — |

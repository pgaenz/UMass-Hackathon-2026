# HistorAI evaluation harness

The harness behind Deliverable 5 (Evaluation). It has three layers so that
deterministic logic, model-backed agent quality, and the integrated product can
be checked separately — and so a reviewer without an API key can still
reproduce most of the results.

| Layer | Command | Network | What it proves |
|-------|---------|---------|----------------|
| **Offline** | `npm run eval` | none | Server-derived verdicts, age validation, public age bands, the production secret policy (fail-closed env), and the chat regex screen behave exactly as specified. |
| **DB repositories** | `npm run eval:db` | Postgres | Every swapped repository module reads/writes Postgres; vote/like writes stay consistent under concurrency; reset/verification tokens are hashed, single-use, and expiring; a password change bumps `sessionVersion` and revokes sessions. |
| **Live agents** | `npm run eval:live` | OpenRouter | Writing, independent review/grounding, safety classification, and the semantic chat screen work on real model calls. |
| **End-to-end** | `npm run dev` + `npm run eval:e2e` | localhost (some cases also use OpenRouter) | The real HTTP routes enforce registration/login/logout, session revocation, the forgot/reset/verify lifecycle, same-origin CSRF on writes, the publish gates, feed isolation, likes/match, and chat screening. |

## Running

```bash
npm install

# 1. Deterministic checks (no key needed)
npm run eval

# 2. Offline + live agent checks (reads OPENROUTER_API_KEY from .env / .env.local)
npm run eval:live

# 3. DB repository checks (uses DATABASE_URL; cleans up after itself)
npm run eval:db

# 4. Black-box HTTP checks — start the app first
npm run dev            # terminal A
npm run eval:e2e       # terminal B
```

For the E2E layer, set `E2E_BASE_URL` to point somewhere other than
`http://localhost:3000`. **Point the dev server at a test database**: before the
first request the harness runs `prisma migrate reset` and seeds the committed
`eval/fixtures/*.json` content via `scripts/seed-test-db.ts`, which also gives the
seeded users credentials (password from `SEED_USER_PASSWORD`), so the run starts
from a known state and can exercise real login. The reset is
destructive to whatever database `DATABASE_URL` names. `npm run eval:db` is
non-destructive: it creates uniquely-tagged rows and removes them again.

## Results

Every run writes machine-readable JSON and a human-readable Markdown table:

```text
eval/results/
  offline.json / offline.md     # verdicts, age, chat patterns
  live.json    / live.md        # real model calls
  e2e.json     / e2e.md         # HTTP routes against a running server
```

The numbers quoted in the project document come from these files.

## Known findings

- **Name safety false positive (`E2E-AGE-08`).** The display-name gate rejects any name
  containing the product term "Drop" (e.g. `Drop Test`, `Peter Drop`) with inconsistent
  reasons ("harmful reference", "dangerous behavior", "inappropriate"). Because a display
  name cannot be auto-rewritten, the user has no path forward. Tracked as a `known` case;
  a fix would allow-list the product vocabulary or route rejected names to human review.
- **Cold-start compile race.** In dev, Next compiles `/youth` on its first request. The
  harness warms the route before checking feed isolation; without that warm-up the check
  can race the compile. Feed isolation itself was also verified deterministically by
  flipping a seeded story between `draft`, `reviewed`, and `published` and re-reading the
  feed.

## Design notes

- **Server-derived verdicts.** `lib/verdicts.ts` contains the production rules
  (`deriveReviewVerdict`, `deriveSafetyVerdict`). The agents only classify; the
  server decides. The offline suite tests those exact rules, so a model can
  never self-approve an article or downgrade its own safety issue.
- **Pure screening layer.** The regex half of chat screening lives in
  `lib/chat-patterns.ts` with no imports, which is why it can be tested offline.
- **Fail-closed semantics.** The semantic chat screen returns `block` when it
  errors or times out; the E2E suite asserts that blocked messages are rejected
  with `422` and are never stored.
- **One-time tokens in E2E.** The reset/verify routes never return the raw token
  (only its SHA-256 hash is stored), so the E2E harness mints a valid token by
  inserting the matching hash directly, then exercises the real consume routes.
- **No lockout.** Phase 5 deliberately ships no failed-attempt counter or lockout
  (owner decision); login stays a single generic `401`.
- **Seeded fixtures for gates.** The publish-gate cases reuse committed seed
  stories (one hard-blocked draft, one story that failed its review) so the
  gate behavior is deterministic and costs no model calls.

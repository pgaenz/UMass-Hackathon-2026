# Postgres migration plan: from JSON files to a real database with accounts and passwords

**Status:** Phases 0–8 are **implemented** (branch `database-migration`). Read the **Decisions**
section first; it records the defaults to use unless the product owner overrides them. See
[Implementation progress](#implementation-progress) for what landed.

**Scope:** replace the `data/*.json` store with PostgreSQL, move every domain module onto a
repository layer, and introduce real email + password accounts with server-side sessions. This
plan finishes the item explicitly deferred in
[`river-experience.md`](./river-experience.md) §14 ("Real authentication, database migration…")
and the item named in `README.md` §"Notes on storage" ("Swapping in a real database later…").

**Baseline:** written against the current working tree. `lib/json-file.ts` provides
`readJson`/`writeJson`/`mutateJson` with per-file locks; `lib/users.ts` and `lib/store.ts` (and
`lib/questions.ts`, `lib/likes.ts`, `lib/question-votes.ts`, `lib/chat.ts`, `lib/conversations.ts`,
`lib/reports.ts`) are the only data-access modules. Auth is passwordless: `POST /api/auth/login`
creates a profile, `POST /api/auth/session` signs in as any `userId`, and the cookie is a signed
HMAC payload (`lib/session-token.ts`). `package.json` has no database dependency.

---

## Implementation progress

| Phase | Status | Summary |
|-------|--------|---------|
| 0. Foundations | ✅ Complete | Docker Compose Postgres 16, Prisma init, `lib/db.ts` singleton, env plumbing, `db:check` connectivity script. |
| 1. Full relational schema | ✅ Complete | All domain + auth models, enums, indexes, unique constraints, FKs, and the initial migration. |
| 2. JSON import | ✅ Complete | Idempotent `scripts/import-json.ts` (`db:import` / `db:import:dry`); imports the nested `topics` and `blocks` collections, validates references, and preserves original ids. |
| 3. Repository swap | ✅ Complete | All eight data modules use Prisma; vote/like counters are atomic; `eval/e2e.mjs` resets + re-seeds Postgres; new `npm run eval:db` suite. |
| 4. Credentials + sessions | ✅ Complete | Argon2id credentials, opaque DB-backed sessions, register/login/logout routes, minimal sign-in/register UI, demo picker removed; `eval:e2e` uses real credentials. |
| 5. Lifecycle + hardening | ✅ Complete | Email (SMTP in prod, console in dev), single-use reset/verification tokens, forgot/reset/change-password routes, same-origin CSRF on API writes, fail-closed production secrets, `AuthAudit`. Owner dropped the failed-attempt lockout from scope. |
| 6. Auth UI | ✅ Complete | Full auth UX: `/login` email + password + forgot link, forgot/reset/verify pages, change-password and resend-verification on `/profile`, confirm-password on register, account picker deleted, passwordless copy removed. |
| 7. Deploy + ops | ✅ Complete | GitHub Actions migrate + fresh-DB CI, `db:pool-check`, `docs/deployment.md` (Neon, pooling, backups, restore drill), env/README updates. Cloud provisioning + staging restore drill remain owner-runbook steps. |
| 8. Cutover + cleanup | ✅ Complete | JSON store removed; seed content moved to `eval/fixtures/`; `lib/json-file.ts` and the one-time importer deleted; docs updated. |

### Decisions pinned for the schema

- **D3 — in-repo auth module** (not Better Auth). The §5.2 tables (`Credential`, `Session`,
  `PasswordResetToken`, `EmailVerificationToken`) are modeled as specified; auth logic lands in
  Phase 4; the optional `AuthAudit` table landed in Phase 5.
- **§5.4 representation choices:**
  1. `Question.storyIds` is **derived** from `Story.questionId` (no join table); `questionId`
     is the single source of truth.
  2. `Conversation.turns` and `Story.feedback`/`review`/`safety` are **JSON** columns.
  3. `ChatThread.participantIds` is `String[]` with a unique `pairKey`; `ChatMessage` is a child
     table so `getThreadMessages(afterId)` ordering still works; `ChatMessage.readBy` is `String[]`.
  4. `Conversation.storyId` is nullable and the `Story.conversationId ↔ Conversation.storyId`
     cycle uses two named, nullable relations with `onDelete: SetNull`.
  5. FK severity: `Story.authorId`, `Question.askedBy`, `Conversation.userId`/`storyId` are
     `SetNull`; `StoryLike`, `QuestionVote`, `ChatMessage`, `ChatBlock` and auth rows cascade.
  6. Denormalized `Question.upvotes` stays; Phase 3 makes the vote/like writes transactional.

## 1. Goal

Let the product run on a real database so that:

1. **Accounts are real.** A user has an email and a password; only the password holder can reach the account from any device.
2. **Data is shared and durable.** Users, stories, questions, votes, likes, conversations, chat, and reports live in one database reachable by every app instance — not in files on one machine.
3. **Sessions are protected and revocable.** A sign-in is an opaque, server-side session that can be listed and revoked, and that survives redeploys.
4. **Nothing observable regresses.** Existing pages, routes, and the writing/safety/accuracy agents behave the same; only the storage and auth internals change. Removing the passwordless demo sign-in (PM-9) is an intentional security fix, not a regression.
5. **The migration is reversible up to the repository swap.** The JSON files are imported, not deleted, until every phase's tests pass in the target environment. The effective cutover is **Phase 3**: from the moment repositories read and write Postgres, new writes exist only there, so rolling back after Phase 3 recovers the original JSON but loses post-cutover data. "Reversible" means the JSON source stays intact and re-importable, not that live state is mirrored.

---

## 2. Current state (verified in the code)

Confirm these facts before editing. If something no longer matches, trust the code and update
this section in the PR.

| Area | What exists today | Gap for Postgres |
|------|-------------------|------------------|
| Storage engine (`lib/json-file.ts`) | `readJson`, atomic `writeJson` (temp + rename), and `mutateJson` under a per-file in-process lock. | Locks are per process; no cross-instance safety. No transactions across files. |
| Users (`lib/users.ts`) | `getUser`, `listUsers`, `createUser`, `updateUser`, `getPublicUserMap`, `toPublicUser`, age/role normalization. | File-backed; `User` has no email or password. |
| Stories (`lib/store.ts`) | `getAllStories`, `getStory`, `getStoriesByStatus`, `getStoriesByAuthor`, `createStory`, `updateStory`, `deleteStory`, `normalizeStory`. | Whole-file rewrite on every mutation; `conversationContext`/agent results stored inline. |
| Other domains | `lib/questions.ts`, `lib/likes.ts`, `lib/question-votes.ts`, `lib/chat.ts`, `lib/conversations.ts`; `lib/reports.ts` bypasses `lib/json-file.ts` with its own **unlocked, non-atomic** `readReports`/`writeReports`. The `app/api/conversation/[id]/turn`, `app/api/generate`, and `app/api/intake` routes only write `data/uploads/*`; they do not read or write the JSON store. | Same file-store limitations; no foreign keys; concurrent `reports.json` writes can lose data. |
| Auth (`lib/session-token.ts`, `lib/session.ts`) | HMAC-signed cookie `historai_session` = `base64url({userId, role}).signature`; `getCurrentUser`, `requireSession`, `requireRole`, `setSession`, `clearSession`, `authorize`. | No password. Token is stateless and cannot be revoked. `SESSION_SECRET` has a dev fallback (`lib/session-token.ts`). |
| Login (`app/api/auth/login/route.ts`) | Passwordless: validates role/name/age, runs `checkSafety`, calls `createUser`, sets session. | Must require existing credentials instead of creating a profile. |
| Demo sign-in (`app/api/auth/session/route.ts`) | Signs in as any `userId` with no secret. `components/existing-account-picker.tsx` consumes it. | **Security hole.** Must be removed or gated before any launch. |
| UI (`app/login/page.tsx`, `app/onboarding/page.tsx`, `components/onboarding-form.tsx`) | Role cards link to onboarding; onboarding creates the profile. | No email/password fields, no register/login split. |
| Data files (`data/`) | `users.json` (58 users), `stories.json` (38), `questions.json` (also carries the top-level `topics` array), `conversations.json`, `chat.json` (also carries `blocks`), `likes.json`, `question-votes.json`; `reports.json` runtime-only (git-ignored); `uploads/` audio (git-ignored). | Must be imported, not lost; `topics` and `blocks` are nested collections that are easy to overlook. |
| Config (`lib/config.ts`, `.env.example`) | `requireEnv` pattern; `SESSION_SECRET` documented but optional. | Needs `DATABASE_URL`, pooling URLs, and a fail-closed secret policy. |
| Tests (`eval/`) | `npm run eval` (offline) and `npm run eval:e2e`; the E2E harness snapshots and restores `data/*.json`. | Snapshot/restore of JSON files will not cover a database and must be rewritten. |

---

## 3. Decisions

Defaults for the implementing agent. Flag any conflict rather than inventing a new default.

| # | Question | Default (use this) | Alternative (only if the owner asks) |
|---|----------|--------------------|--------------------------------------|
| D1 | Database engine | **PostgreSQL 16.** Local via Docker Compose; hosted on **Neon** for deploy. | Self-hosted Postgres on a VPS; Turso/libSQL only if SQLite ergonomics are required. |
| D2 | ORM / query layer | **Prisma** (schema, migrations, `prisma migrate deploy`). | Drizzle. |
| D3 | Auth implementation | **Better Auth** over Prisma, handling hashing, sessions, reset, verification. **Decide before Phase 1** so the schema matches the library's credential/session tables. | A compact in-repo `lib/auth/*` module (bcrypt/argon2 + opaque sessions) if library integration proves fragile. |
| D4 | Session model | **DB-backed opaque token**: 32 random bytes, only SHA-256 hash stored; httpOnly, `Secure` in production, `SameSite=Lax`; 30-day sliding expiry; revocable. | Signed JWT. Not recommended — cannot revoke. |
| D5 | Password hashing | **Argon2id** (or bcrypt cost ≥ 12 if the runtime requires it). Never reversible, never logged. | — |
| D6 | Email delivery | Dev: log verification/reset links to the server console. Prod: owner-provided provider (e.g. Resend). | No email; admin-issued reset links. |
| D7 | Migration method | **Big-bang, one-time idempotent import** (`upsert` by original id). JSON files kept read-only for one release, then removed. **Effective cutover is Phase 3** (the repository swap); after that, new writes live only in Postgres. | Dual-write during a transition window. Not recommended. |
| D8 | Concurrency | Multiple concurrent sessions per account (multi-device) are allowed. A password change bumps `sessionVersion` and revokes all sessions. | Single active session per account. |
| D9 | Refactor strategy | **Keep exported function signatures.** Repo modules swap internals; routes and components keep calling the same functions. | Rewrite routes around the ORM. Larger blast radius. |
| D10 | Uploads | Stay on local disk in this plan. Moving to S3/R2 is a follow-up. | Include an uploads phase now. |
| D11 | Production secret policy | `SESSION_SECRET` (and `DATABASE_URL`) required in production; the app fails closed if missing. | Keep dev fallback in all environments. Not acceptable for launch. |

---

## 4. Target architecture

```text
Browser ──httpOnly cookie──► Next.js route handlers / server components
                                     │
                       lib/session.ts (authorize, getCurrentUser)
                                     │
                    ┌────────────────┴─────────────────┐
                    ▼                                  ▼
              Auth tables                        Domain repositories
        Credential · Session · Token      lib/users.ts · lib/store.ts · …
                    └────────────────┬─────────────────┘
                                     ▼
                              lib/db.ts (Prisma singleton)
                                     ▼
                            PostgreSQL 16
                 (Docker Compose locally · Neon in prod)
```

- `lib/db.ts` exports one `PrismaClient` that survives Next.js hot reload.
- `middleware.ts` stays on the edge and only verifies the cookie's **presence/format**. With the opaque token in D4 there is no signature or embedded role to verify, so the `/senior` role redirect moves entirely to `requireRole` in server components (`requireRole` already enforces it). `middleware.ts` and `lib/session-token.ts` are in scope for Phase 4. **Authoritative** session lookup (DB row + `expiresAt` + `sessionVersion`) stays in Node via `lib/session.ts`.
- `lib/json-file.ts` is retained during migration and deleted in Phase 8.

---

## 5. Data model

One table per JSON collection, plus auth tables. Field names mirror `lib/types.ts` so
`toPublicUser` and existing callers keep working.

### 5.1 Domain tables

| Table | Key columns | Notes |
|-------|-------------|-------|
| `User` | `id`, `role`, `name`, `age`, `bio`, `interests`, `createdAt`, `updatedAt`, `sessionVersion` | `role` constrained to `river`/`drop`. `interests` is `Json` or a join table. |
| `Story` | existing `Story` fields; `authorId` nullable FK, `questionId` nullable FK | Inline agent output (`review`, `safety`, `metadata`) stored as `Json` to avoid over-normalizing. Index on `status`, `authorId`, `questionId`, `createdAt`. |
| `Question` | existing `Question` fields | Index on `createdAt`; `storyIds` is derived from `Story.questionId` (single source of truth) or stored as an explicit join — decide once in Phase 1 and make import plus both link helpers agree (§5.4). |
| `Topic` | `id`, `label` | Source is the top-level `topics` array in `data/questions.json`. Referenced by `Question.topicIds` and `User.interests`; without it `getTopics()` has no data source. |
| `QuestionVote` | `questionId`, `userId`, `createdAt` | Unique `(questionId, userId)`. |
| `StoryLike` | `storyId`, `userId`, `createdAt` | Unique `(storyId, userId)`. |
| `Conversation` | existing `Conversation` fields; `userId` nullable, `storyId` FK | Turns stored as `Json` array or a child table; decide in Phase 1. |
| `ChatThread` / `ChatMessage` | as in `lib/chat.ts` | FKs to users; index on thread + `createdAt`. `participantIds`/`pairKey`, message `readBy`, and ordering are decided in §5.4. |
| `ChatBlock` | `blockerId`, `blockedId`, `createdAt` | Unique `(blockerId, blockedId)`. Source is the `blocks` array in `data/chat.json`; required by `isBlocked`/`blockUser`. |
| `Report` | as in `lib/reports.ts` | Runtime-only today; becomes a normal table. |

### 5.2 Auth tables

| Table | Key columns | Notes |
|-------|-------------|-------|
| `Credential` | `userId` PK/FK, `email` unique (normalized lowercase), `passwordHash`, `emailVerifiedAt`, `failedAttempts`, `lockedUntil` | One credential per user. Secrets never cross the wire. |
| `Session` | `id` (hash of token), `userId`, `expiresAt`, `createdAt`, `userAgent`, `ip`, `revokedAt` | Deleting the row is logout. |
| `PasswordResetToken` | `tokenHash` PK, `userId`, `expiresAt`, `usedAt` | Single-use, hashed at rest. |
| `EmailVerificationToken` | `tokenHash` PK, `userId`, `expiresAt`, `usedAt` | Same rules. |
| `AuthAudit` (optional) | `id`, `userId` nullable, `event`, `ip`, `userAgent`, `createdAt` | Login, lockout, reset, password change. |

### 5.3 JSON → table mapping

| Source file | Destination |
|-------------|-------------|
| `data/users.json` | `User` (+ `Credential` via invite/reset, D6) |
| `data/stories.json` | `Story` |
| `data/questions.json` | `Topic` (top-level `topics`) + `Question` |
| `data/question-votes.json` | `QuestionVote` |
| `data/likes.json` | `StoryLike` |
| `data/conversations.json` | `Conversation` |
| `data/chat.json` | `ChatThread` / `ChatMessage` / `ChatBlock` |
| `data/reports.json` | `Report` |
| `data/uploads/` | **Not migrated** (stays on disk in this plan, D10) |

### 5.4 Representation decisions to pin down before Phase 1

These are ambiguous today and change the importer and the repository signatures, so decide them in Phase 1 rather than mid-phase:

- **Story ↔ Question.** Both `Story.questionId` and `Question.storyIds` exist and are written independently (`linkStoryToQuestion`/`unlinkStoryFromQuestion`). Pick one source of truth (derive `storyIds` from `questionId`, or keep an explicit join row) and make import plus both helpers use it. Do not keep both as authoritative.
- **Conversation turns.** `ConversationTurn.index` is assigned as `turns.length`. If turns become a child table, order by `index` and preserve the same compacting behavior; a JSON column keeps the existing code shape.
- **Chat.** `ChatMessage.readBy: string[]` (array column vs join table), `ChatThread.participantIds` sorted pair + `pairKey` uniqueness, and per-thread message ordering must be reproduced exactly so inbox/unread counts and `getThreadMessages(afterId)` keep working.
- **Circular reference.** `Conversation.storyId` → `Story` and `Story.conversationId` → `Conversation` is a cycle; make at least one side nullable/deferrable so inserts succeed.
- **FK severity.** Decide cascade vs null for each nullable FK (`Story.authorId`, `Question.askedBy`, `Story.questionId`, `Conversation.userId`/`storyId`, `ChatBlock.*`) to match today's tolerant JSON behavior ("legacy content renders as community", "a missing other user hides the thread").
- **Denormalized counters.** `question.upvotes` and per-story like counts are read-modify-written (`setVote` + `adjustUpvotes`, `setLike`). Wrap the vote/like write and the counter update in a transaction or use an atomic increment so concurrent requests cannot drift the count. Unique constraints stop duplicate rows, not stale counts.

---

## 6. Phases

Each phase must leave the app building and the existing tests passing. Run `npm run build` at
the end of every phase.

| Phase | Scope | Done when |
|-------|-------|-----------|
| **0. Foundations** | Docker Compose Postgres, Prisma init, `lib/db.ts`, env plumbing, connectivity check. | A clean clone can start Postgres and run `prisma migrate dev` with no manual steps. |
| **1. Full schema** | Prisma models for every domain + auth table (§5), including `Topic` and `ChatBlock`, plus the §5.4 representation decisions; first migration. | `prisma migrate dev` creates all tables and indices; schema matches `lib/types.ts` fields. |
| **2. JSON import** | Idempotent `scripts/import-json.ts`, `--dry-run`, integrity report; imports the nested `topics` and `blocks` collections too. | Every JSON row is present in Postgres with the original id; re-running adds no duplicates. |
| **3. Repository swap** | Move the eight `lib/*` data modules (including `lib/reports.ts`, which has no shared lock today) onto Prisma (D9). | Feed, stories, ask/answer, votes, likes, chat, and reports work identically against Postgres. |
| **4. Credentials + sessions** | Register/login/logout, hashing, DB sessions, `session-token.ts`/`middleware.ts` update, and a **minimal working login + register form in the same phase** (so no phase leaves the app without a sign-in path); remove demo picker (D3–D5, D8). | Two devices hold independent sessions for one account; the demo sign-in endpoint is gone or gated; the UI can register and sign in. |
| **5. Lifecycle + hardening** | Reset, verification, rate limit, lockout, CSRF, fail-closed secrets (D6, D11). | Full password lifecycle works; enumeration and brute force are mitigated. |
| **6. Auth UI** | Finish the auth UX: forgot/reset page, onboarding/register split, remove account-picker copy, keyboard/a11y polish. (The minimal login/register form landed in Phase 4.) | `/login` shows email + password; no passwordless path remains in the UI. |
| **7. Deploy + ops** | Hosted Postgres, pooling, migrations in CI, backups, README/env docs. | Production runs on Postgres with tested restore; no data written to local files. |
| **8. Cutover + cleanup** | Remove `data/*.json` runtime dependency and `lib/json-file.ts`; update docs. | `grep` shows no runtime reads of `data/*.json` (except uploads); all criteria in §8 pass. |

---

### Phase 0 — Foundations ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** A developer (or agent) can bring up PostgreSQL locally and connect Prisma to it with a single command. No domain code changes yet.

**Work.** `docker-compose.yml` (Postgres 16 + volume); Prisma install and `prisma init`; `prisma/schema.prisma` with the datasource only; `lib/db.ts` singleton; add `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` to `.env.example`; a small connectivity check (`scripts/db-check.ts` or `/api/health/db`).

**Acceptance.**

- `docker compose up -d db` starts Postgres; `docker compose down -v` removes it cleanly.
- `npx prisma validate` and `npx prisma migrate dev` succeed against the local database.
- `lib/db.ts` returns one client across hot reloads (no "too many clients" during `next dev`).
- The connectivity check reports success and a clear error when `DATABASE_URL` is wrong.
- `npm run build` passes; no route or component behaviour changes.

---

### Phase 1 — Full relational schema ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** The complete database shape exists in one versioned migration, matching the current JSON semantics (nullable `authorId`, optional story fields, etc.).

**Work.** Add all models and enums from §5 (including `Topic` and `ChatBlock`); apply the §5.4 representation decisions; indexes and unique constraints (`Credential.email`, `QuestionVote (questionId,userId)`, `StoryLike (storyId,userId)`, `ChatBlock (blockerId,blockedId)`, FKs and lookup indexes); `prisma format`; commit migration under `prisma/migrations/`.

**Acceptance.**

- `npx prisma migrate dev` creates every table with the documented columns and indices.
- Nullability matches today's data: legacy stories load with `authorId = null`; optional story fields are nullable.
- Foreign keys enforce integrity (a like/vote/story referencing a missing user fails).
- `npx prisma migrate reset` rebuilds from migrations with no drift (`prisma migrate diff` clean).
- `npm run build` passes.

---

### Phase 2 — One-time JSON import

**Outcome.** All committed JSON data is loaded into Postgres with original ids preserved, so `story.authorId` and similar references stay valid.

**Work.** `scripts/import-json.ts` with `--dry-run`; read each file via the existing `lib/json-file.ts`; upsert by id; validate references; print a report (inserted, updated, skipped, orphans). Seed users get no password — issue invite/reset tokens (D6) or mark them "must reset".

**Acceptance.**

- Row counts equal the source counts for `users`, `stories`, `questions`, `question-votes`, `likes`, `conversations`, `chat`, and (if present) `reports`, including the nested collections: the `topics` array in `data/questions.json` and the `blocks` array in `data/chat.json`.
- Every imported id equals the JSON id; `getUser`/`getStory` by original id resolves.
- Referential integrity is reported before writing: orphan `authorId`, `questionId`, `storyId`, or user references are listed and handled (nulled or skipped) explicitly.
- Re-running the script produces zero new rows (idempotent).
- The script never modifies or deletes the source JSON files.

---

### Phase 3 — Repository layer swap ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** Every data-access module reads and writes Postgres through Prisma. All existing exports keep their signatures, so routes, server components, and components are unchanged.

**Work.** Rewrite `lib/users.ts`, `lib/store.ts`, `lib/questions.ts`, `lib/likes.ts`, `lib/question-votes.ts`, `lib/chat.ts`, `lib/conversations.ts`, `lib/reports.ts` (reports gains the shared locking/atomicity it lacks today); make `setVote`/`adjustUpvotes` and `setLike` transactional so denormalized counters cannot drift; keep `toPublicUser` stripping private fields (now including anything added to `User`). The three upload routes (`app/api/conversation/[id]/turn`, `app/api/generate`, `app/api/intake`) keep writing `data/uploads/*` and need no store rewrite. Replace the `eval/e2e.mjs` JSON snapshot/restore with a database reset/seed of a test database.

**Acceptance.**

- The eight modules call Prisma; `lib/json-file.ts` has no callers among them (`grep`).
- All exported names/signatures are unchanged; TypeScript reports no caller changes.
- `toPublicUser` and any API response omit `email`, `passwordHash`, and other secrets.
- `npm run build`, `npm run eval`, and `npm run eval:e2e` pass against Postgres.
- Manual smoke: home feed, read a story, ask a question, answer one, upvote, like, send a chat message, file a report.
- Deletes cascade or clean up as before (e.g. deleting a story removes its likes and question links).
- Vote/like writes update the denormalized counter atomically (transaction or increment); a DB concurrency test confirms no drift.
- `lib/reports.ts` no longer touches the filesystem and no longer races on `reports.json`.

---

### Phase 4 — Credentials and sessions ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** Real email + password accounts replace the passwordless profile creation and the demo user picker. Server-side sessions support multi-device use and revocation.

**Work.** Registration and login endpoints (or Better Auth handlers); password hashing (D5); opaque session creation in `lib/session.ts` (D4); **session validation (DB row, `expiresAt`, `sessionVersion`) in `getSession()` so `authorize()` enforces revocation too** — not only in `getCurrentUser`; logout revokes the row; update `lib/session-token.ts` and `middleware.ts` for the opaque token (middleware presence/format only, `/senior` role gate via `requireRole`); ship a minimal email + password login/register form; remove or non-production-gate `POST /api/auth/session` and the account picker's use of it.

**Acceptance.**

- Registration creates `User` + `Credential` in one transaction; rejects duplicate email, weak passwords, invalid role/age, and unsafe names.
- Login verifies the hash, returns a generic "Invalid email or password" on failure, and sets the cookie plus a `Session` row.
- Logout deletes the session row and clears the cookie; the old cookie no longer authenticates.
- A revoked or expired session is rejected by **every** guard, including `authorize()`-protected API routes, not just page renders.
- The shipped login/register form lets a new user register and sign in; the app is never left without a working sign-in path between phases.
- Two browsers/devices sign in as the same account independently; logging out of one leaves the other valid (D8).
- The cookie is httpOnly and `Secure` in production; its value reveals no `userId` or role to JavaScript.
- `POST /api/auth/session` is removed, or returns 404 outside an explicit `ALLOW_DEMO_SIGNIN` non-production flag.
- `npm run build` and the E2E auth cases pass.

---

### Phase 5 — Password lifecycle and hardening ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** Users can verify email and reset a forgotten password, and the endpoints resist enumeration.

**Work.** Verification and reset token generation/consumption (hashed, single-use, expiring); `nodemailer`/provider in production and console links in dev (D6); `sessionVersion` bump on password change; Origin/CSRF checks on mutating routes; fail-closed secret policy (D11); optional `AuthAudit` rows.

> **Scope note (owner decision).** Rate limiting and the `failedAttempts`/`lockedUntil` lockout
> were explicitly removed from this phase. The login response stays a single generic `401`.

**Acceptance.**

- "Forgot password" always returns the same response whether or not the email exists. ✅
- A reset link works once, expires, and rotates the password hash; using it revokes all existing sessions. ✅
- Verification tokens behave the same way. ✅
- State-changing requests require a same-origin request (or CSRF token); cross-origin attempts are rejected. ✅
- In production, a missing `DATABASE_URL` or `SESSION_SECRET` prevents startup instead of falling back to defaults. ✅
- ~~Repeated failed logins trigger lockout/backoff without revealing account existence.~~ Dropped by the owner.

---

### Phase 6 — Auth UI ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** The sign-in experience is complete: the minimal login/register form from Phase 4 is finished into the full flow, with email + password, a registration path that also collects the profile, and a forgot-password page. No passwordless entry remains.

**Work.** Polish `app/login/page.tsx` (email/password + visitor); finish the register/onboarding split (`components/onboarding-form.tsx` submits credentials + profile); add a forgot/reset page; delete `components/existing-account-picker.tsx` and any remaining demo copy.

**Acceptance.**

- `/login` presents labelled email and password fields, a submit action, and the visitor option.
- A new user can register, complete the profile, and land signed in without a separate passwordless call.
- The forgotten-password flow is reachable and its copy matches the security behaviour (no account-existence hints).
- No "no password needed" or demo-picker copy remains (`grep`).
- Keyboard-only login/register works; errors are in `role="alert"`; `npm run build` passes.

---

### Phase 7 — Deployment and operations ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** The product runs on a hosted Postgres with pooling, migrations in the release process, and tested backups.

**Work.** Provision Neon (pooled `DATABASE_URL` + `DIRECT_URL` for migrations); run `prisma migrate deploy` in CI/release; enable backups/PITR and document a restore; verify connection limits; update `.env.example`, `README.md`, and the route tables.

**Acceptance.**

- Production starts with the hosted database and no local file writes for data.
- `prisma migrate deploy` runs in CI and applies to a fresh and an existing database.
- A documented restore from backup is performed at least once in staging.
- The app serves concurrent requests without exhausting Postgres connections.
- README storage and configuration sections describe Postgres, sessions, and required env vars.

**What landed.**

- **CI migrations (fresh database).** `.github/workflows/ci.yml` runs on `main` and pull requests
  against a throwaway PostgreSQL 16 service container; `npx prisma migrate deploy` builds the
  schema from committed migrations, `prisma migrate diff --exit-code` checks for drift, then
  type-check, build, `npm run eval`, and `npm run eval:db` run.
- **Release migrations (existing database).** `.github/workflows/migrate.yml` applies migrations to
  the hosted database on `main` when migrations change, or manually via *Run workflow* (requires
  typing `migrate`). It targets the GitHub Environment `production` so required reviewers gate it,
  and uses the direct (non-pooled) `DIRECT_URL` Prisma requires for `migrate deploy`.
- **Connection-limit smoke check.** `scripts/db-pool-check.ts` (`npm run db:pool-check`, also
  `POOL_CHECK_CONCURRENCY=60 …`) fires N concurrent queries and reports the configured
  `connection_limit`, the server `max_connections`, and the peak backend count from
  `pg_stat_activity`; non-destructive and exits non-zero on any failure.
- **Operations runbook.** `docs/deployment.md` documents Neon provisioning (pooled `DATABASE_URL`
  + direct `DIRECT_URL`), required env vars, `migrate deploy`, CI/CD secrets and environment,
  pool sizing, Neon PITR + `pg_dump` backups, point-in-time and logical restore runbooks, a staging
  restore-drill checklist with a sign-off table, the local-disk uploads caveat, and rollback.
- **Configuration/docs.** `.env.example` documents the pooled-vs-direct split, `connection_limit`
  guidance, and a Resend SMTP example. `README.md` now describes PostgreSQL storage, the Quick
  Start database step, required env vars (`DATABASE_URL`, `DIRECT_URL`, `SMTP_*`), the auth API
  routes, and links the deployment doc; stale “no database” copy was removed.
- **No application-code change.** Phase 7 adds CI, a script, and docs only; Phases 0–6 behaviour is
  untouched.

**Verified (against local PostgreSQL 16):** `npx tsc --noEmit`, `npm run build`, `npm run eval`
(pure), `npm run eval:db` (63/63), and `npm run db:pool-check` (peak 17 backends, 60 concurrent
queries, 0 failures) all pass; `prisma migrate diff --exit-code` reports no drift. The GitHub
workflows are committed but were **not executed on GitHub** from this environment.

**Owner steps still required (need cloud access):** provision Neon, add the `DATABASE_URL` /
`DIRECT_URL` repository secrets and the `production` environment, trigger the first
`migrate deploy`, run the one-time `db:import` against the hosted database, configure `SMTP_*`,
and perform the staged backup-restore drill (§7.C of `docs/deployment.md`).

---

### Phase 8 — Cutover and cleanup ✅ (implemented; see [Implementation progress](#implementation-progress))

**Outcome.** The JSON store is no longer part of the running system. The codebase has one storage engine.

**Work.** Confirm the production database matches the imported JSON; remove the `data/*.json` files from runtime use (archive or delete per owner); delete `lib/json-file.ts`; remove demo/seed-only code paths; rewrite the README storage section; update `MVP.md` where it says "no database".

**Acceptance.**

- `grep` finds no runtime read of `data/*.json`; only `data/uploads/` remains file-based. ✅
- `lib/json-file.ts` is deleted and nothing imports it. ✅
- All acceptance criteria in §8 pass on the deployed app. ⏳ owner-run (needs production access)
- `npm run build`, `npm run eval`, and `npm run eval:e2e` pass against Postgres. ✅
- No seed content was altered during migration (compare imported rows to the archived JSON). ⏳ owner-run against the external copy

**What landed.**

- **Seed content relocated.** The seven committed JSON files moved from `data/` to
  `eval/fixtures/` with `git mv` (history preserved). `data/` now contains only the git-ignored
  `uploads/` directory, so the app has no runtime JSON store.
- **`lib/json-file.ts` deleted.** No module imports it; the stale `.gitignore` entry for
  `data/reports.json` was removed.
- **One test seeder replaces the importer and the credential seeder.** `scripts/import-json.ts`
  and `scripts/seed-test-credentials.ts` are gone; `scripts/seed-test-db.ts`
  (`npm run db:seed:test`) reads `eval/fixtures/*.json` with plain `fs`, upserts every domain row
  by original id, reports orphan references, and gives the seeded users the shared test
  credential. It refuses to run when `NODE_ENV=production`.
- **E2E harness rewired.** `eval/e2e.mjs` reads fixtures from `eval/fixtures/` and seeds through
  `scripts/seed-test-db.ts`; nothing in `app/`, `components/`, or `lib/` reads `data/*.json`.
- **Docs updated.** `README.md` (Quick Start, storage notes, directory tree, troubleshooting),
  `docs/deployment.md` (no production seed import; seed/test and rollback notes), `MVP.md`
  (storage/login/data-model sections), and `eval/README.md`.
- **Scope untouched.** No agent prompts, publish semantics, route signatures, or Prisma schema
  changed.

**Verified (against local PostgreSQL 16):** `npx tsc --noEmit`, `npm run build`, `npm run eval`
(102/102), `npm run eval:db` (63/63), and `npm run eval:e2e` (62 passed, 1 known, 3 skipped,
0 failed) all pass. A second `npm run db:seed:test` run inserts 0 rows (idempotent). `grep` finds
no runtime read of `data/*.json` and `lib/json-file.ts` is gone. The three E2E skips are
pre-existing fixture gaps (no hard-blocked story, no multi-liker match story, no null-author
story), not regressions.

**Owner steps still required (need production access):** confirm the deployed database row
counts match the external copy of `data/*.json`, and run the §8 acceptance checks against the
deployed app.

---

## 7. Testing

Follow the existing harness in `eval/` (see `eval/README.md`).

**Offline (`npm run eval`) stays pure** — it must keep running with no database and no API key, so repository tests do **not** go here. Keep/add the pure checks: server-derived verdicts, age validation, chat patterns, `toPublicUser` (never emits `email`/`passwordHash`), and the pure ownership/role decision helpers.

**New DB-backed suite (`npm run eval:db`, throwaway Postgres):**

- CRUD for users, topics, stories, questions, votes, likes, chat threads/messages/blocks, conversations, reports.
- Import idempotency: run the importer twice and assert equal row counts, including `topics` and `blocks`.
- Integrity: a vote/like/story with a missing foreign key is rejected.
- Counter atomicity: concurrent `setVote`/`setLike` calls cannot drift `question.upvotes` or like counts.

**E2E (`npm run dev` then `npm run eval:e2e`), add or replace:**

- **Replace** the JSON snapshot/restore in `eval/e2e.mjs` with a test-database reset + seed per run. The harness currently signs in with the demo endpoint (`POST /api/auth/session`); Phase 3 may keep using it, and the Phase 4 change that removes/gates it must update `signIn()` to real credentials in the same PR.
- `POST /api/auth/register` rejects duplicates and weak passwords; succeeds otherwise.
- `POST /api/auth/login` returns 401 for a wrong password and 200 for a correct one.
- A protected route returns 401 without a session and 403 for the wrong role.
- Logout invalidates the session; a second session for the same user stays valid.
- The demo sign-in endpoint is gone or gated.
- Reset/verification links are single-use and expire.
- Existing flows still pass: feed, story read, ask, answer, upvote, like, chat, report.

**Manual checks (record results in the PR):**

- Sign up on one browser, sign in on a second with the same credentials, use both at once.
- Restart the app; both sessions still work (sessions live in the database).
- Change the password; confirm other sessions are signed out.
- Run the import on a copy of the production-like data and compare counts.
- Point `DATABASE_URL` at a broken host; confirm a clear failure, not a silent fallback.

**Build:** `npm run build` must pass at every phase.

---

## 8. Acceptance criteria

- **PM-1** All committed JSON data (including the nested `topics` and `blocks` collections) is imported with original ids preserved; re-running the import creates no duplicates.
- **PM-2** Every domain module reads and writes Postgres; no runtime code reads `data/*.json` except uploads.
- **PM-3** A user registers and signs in with an email and password; no passwordless path exists in production.
- **PM-4** Passwords are stored only as a strong one-way hash and are never logged or returned by any API.
- **PM-5** Sessions are server-side, opaque, httpOnly, revocable, and survive app restarts; multiple devices can hold independent sessions (D8).
- **PM-6** Logout, password change, and reset revoke the relevant sessions.
- **PM-7** Reset and verification tokens are hashed at rest, single-use, and expiring.
- **PM-8** Login does not reveal whether an email exists, and repeated failures are rate-limited or locked.
- **PM-9** The demo sign-in endpoint and account picker are removed or non-production-gated.
- **PM-10** Production fails closed when `DATABASE_URL` or `SESSION_SECRET` is missing.
- **PM-11** Existing features (feed, stories, questions, votes, likes, chat, conversations, reports, agents) behave as before.
- **PM-12** `npm run build`, the pure `npm run eval`, the DB-backed `npm run eval:db`, and `npm run eval:e2e` all pass; a documented backup restore has been tested.

---

## 9. Non-goals

- Moving audio uploads off local disk (follow-up; D10).
- OAuth / social sign-in, multi-factor authentication, or SSO.
- Changing the writing, review, or safety agents' prompts or thresholds.
- Changing publish rules or story state semantics.
- Real email deliverability guarantees in dev (links are logged to the console; D6).
- Horizontal replication, read replicas, or sharding.
- A full admin/moderation UI beyond what `reports` already supports.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Import loses or corrupts data | `--dry-run` first; keep JSON files read-only until Phase 8; compare counts and ids; back up the target DB before import. |
| E2E harness depends on JSON snapshots | Rewrite it in Phase 3 to reset/seed a test database before anything else depends on it. |
| Prisma client leaks across hot reload | Central `lib/db.ts` singleton, verified in Phase 0. |
| Prisma in edge middleware | Keep authoritative auth in Node handlers; middleware only does a cheap cookie check. |
| Better Auth integration friction | Choose D3 **before Phase 1** (the schema depends on it); keep the in-repo module as the fallback, but decide before coding. |
| `Topic` / `ChatBlock` omitted from the schema | Explicit models and import rows in §5 / Phases 1–2; the import report checks nested collections. |
| Phase 4 removes auth paths before the UI exists | Ship a minimal login/register form in Phase 4; keep Phase 6 for forgot/reset and polish. |
| `authorize()` does not enforce DB revocation | Validate the DB session row in `getSession()`; E2E asserts a revoked session is rejected by a protected API route. |
| Denormalized counters drift under concurrency | Transaction or atomic increment in vote/like repositories; DB concurrency test. |
| Session semantics change user expectations | Keep the `SessionData`/`authorize` **signatures** stable (D9), but change their internals to validate the DB session row (`expiresAt`, `sessionVersion`); do not leave `authorize()` on the stateless token. |
| Production connection exhaustion | Pooled `DATABASE_URL`, `DIRECT_URL` for migrations, and a load smoke test in Phase 7. |
| Seed users have no passwords | Issue invite/reset tokens at import; document the first-login flow. |

---

## 11. Open questions for the product owner

1. Confirm D3: **Better Auth**, or the compact in-repo module? Decide before Phase 1, because the schema depends on it.
2. Confirm D1/D7: **Neon**, or a self-hosted Postgres on a VPS? This changes only Phase 7.
   *(Resolved for Phase 7: **Neon** — pooled `DATABASE_URL` for the app, direct `DIRECT_URL` for
   migrations. The app targets a long-lived Node/Docker host; see `docs/deployment.md`.)*
3. Confirm D6: which email provider for production, and when do you want real verification/reset emails?
   *(Resolved for Phase 5: dev/test logs links to the console; production sends over generic
   SMTP via `nodemailer`. Configure `SMTP_HOST`/`SMTP_FROM` in Phase 7. A specific provider is
   still a Phase 7 decision.)*
   *(Resolved for Phase 7: the code stays provider-agnostic; **Resend** is the documented
   recommended provider, with SendGrid/Postmark as alternatives.)*
4. Should seed/demo accounts get known passwords, or must every seeded user reset on first login?
   *(Phase 4 interim: a dev/test-only credential seeder gave seeded users a shared password so
   E2E could use real login. Phase 5 provides the real forgot/reset flow, so production seed users
   can set a password themselves. In Phase 8 the credential seeding was folded into the single
   `npm run db:seed:test` script.)*
5. Confirm D8: are multiple concurrent sessions per account acceptable?
6. When should `data/*.json` be deleted — immediately after the Phase 8 cleanup, or kept archived for one release?
   *(Resolved for Phase 8: deleted from the running repo after the owner took an external copy;
   the committed content now lives in `eval/fixtures/` as test/dev seed data.)*

---

## 12. Handover checklist for the implementing agent

- [x] Read this plan in full, plus `lib/json-file.ts`, `lib/users.ts`, `lib/store.ts`, `lib/session.ts`, and `lib/session-token.ts`.
- [ ] Confirm §2 against the code and note any difference in the PR description.
- [ ] Confirm `Topic` and `ChatBlock` are modeled and imported, and record the §5.4 representation choices before Phase 1.
- [ ] Phase 0 merged and verified before any other phase starts.
- [x] Keep exported function signatures (D9); do not change agent prompts, safety rules, or publish semantics.
- [x] Do not modify committed seed content; relocate it as-is (`data/*.json` → `eval/fixtures/*.json`).
- [x] Rewrite the `eval/e2e.mjs` JSON snapshot/restore in Phase 3, before domain work depends on it.
- [x] Each phase: `npm run build`, `npm run eval` (pure), `npm run eval:db` / `npm run eval:e2e` once they exist, and the manual checks in §7.
- [x] Update `README.md` storage notes and `MVP.md` where it claims "no database" (no route-table changes were needed).
- [x] Document required env vars (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `SMTP_*` email provider) in `.env.example`.
- [ ] Summarize changed paths, behaviour, validation performed, and known limitations in the PR.

# Deployment & operations

Phase 7 of [`plan/postgres-migration.md`](../plan/postgres-migration.md): run the product on a
hosted PostgreSQL database with pooled connections, migrations in the release process, and a
tested backup/restore path.

This document is the operator runbook. It assumes the defaults pinned in the plan (D1, D6, D7):
**PostgreSQL 16 on Neon**, reached over a pooled URL at runtime and a direct URL for migrations,
with generic SMTP for email.

## Target architecture

```text
Browser ──httpOnly cookie──► Next.js (long-lived Node process)
                                   │
                     lib/session.ts (DB-backed sessions)
                                   │
                            lib/db.ts (Prisma pool)
                                   │
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                     ▼
  pooled DATABASE_URL                              DIRECT_URL (migrations,
  (app runtime)                                    backups, PITR)
        └──────────────────────────┬──────────────────────────┘
                                   ▼
                         Neon PostgreSQL 16
                    (branches · PITR · pooling)
```

- The running app uses the **pooled** `DATABASE_URL` (Neon `-pooler` host).
- Migrations, `pg_dump`, and admin work use the **direct** `DIRECT_URL`.
- Keep these separate: a PgBouncer transaction pooler cannot run migrations reliably.

### Hosting note: uploads are still local disk

Audio uploads continue to live in `data/uploads/` (plan D10 defers object storage; it is a
non-goal). That directory is **ephemeral on serverless platforms**: a recording written by one
invocation is not visible to the next. For that reason the recommended host is a **long-lived
Node runtime in a container** (Fly.io, Railway, Render, a VPS, or any Docker host). If you deploy
to Vercel, data in Postgres is safe, but recorded audio will not persist — plan the S3/R2
follow-up before relying on uploads in production.

## 1. Provision Neon

1. Create a Neon project (PostgreSQL 16) and a database, e.g. `historai`.
2. Open **Connection Details** and copy both strings:
   - **Pooled** connection string → `DATABASE_URL` (host contains `-pooler`).
   - **Direct** connection string → `DIRECT_URL` (no `-pooler`).
3. Append pool parameters to the pooled URL (see [Pooling](#5-connection-pooling)):
   `...?sslmode=require&pgbouncer=true&connection_limit=5`.
4. Create a **staging branch** off `main` for the restore drill and pre-release checks.
5. Enable **Point-in-Time Restore** and note the retention window for your plan.

Neon offers a free tier; production should use a paid plan with a longer history window.

## 2. Environment variables

Set these in the hosting provider's dashboard (and as GitHub secrets/CI variables where noted).
`.env.example` documents them all.

| Variable | Where | Required | Purpose |
|----------|-------|----------|---------|
| `DATABASE_URL` | app + CI secret | Yes | Pooled runtime connection to Postgres. |
| `DIRECT_URL` | app + CI secret | Yes | Direct connection for migrations (`prisma migrate deploy`) and backups. |
| `SESSION_SECRET` | app | Production | Fail-closed per D11; startup aborts if missing. |
| `OPENROUTER_API_KEY` | app | Yes | AI requests. |
| `SMTP_HOST` / `SMTP_FROM` (+ `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`) | app | Production | Password reset / verification email. Unset in production makes reset an error. |
| `SEED_USER_PASSWORD` | local/test only | No | Dev-only credential seeding; the script refuses `NODE_ENV=production`. |

Recommended provider for SMTP: **Resend** (`smtp.resend.com`, user `resend`, password = API key).
SendGrid and Postmark work identically.

## 3. Running migrations

| Situation | Command |
|-----------|---------|
| Local development | `npm run db:migrate` (`prisma migrate dev`) |
| Apply committed migrations to a deployed DB | `npx prisma migrate deploy` |
| See pending/applied state | `npx prisma migrate status` |

`migrate dev` is for local schema changes only; never run it against production. Production uses
`migrate deploy`, which is non-interactive and only applies already-committed migrations.

## 4. CI/CD

Two GitHub Actions workflows ship with Phase 7:

- **`.github/workflows/ci.yml`** — runs on every push to `main` and every pull request. It
  starts a throwaway PostgreSQL 16 service container, applies all migrations to a **fresh**
  database with `prisma migrate deploy`, checks for schema drift with `prisma migrate diff`,
  type-checks, builds, and runs the offline + DB evaluation suites.
- **`.github/workflows/migrate.yml`** — applies migrations to the **existing** hosted database.
  It runs on `main` when `prisma/migrations/**` or `prisma/schema.prisma` change, or manually via
  *Run workflow*. It targets the GitHub Environment `production`, so required reviewers can gate it.

### Repository secrets

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |

### First deployment checklist

1. Add the two repository secrets.
2. Create the `production` GitHub Environment and add required reviewers.
3. Trigger **Migrate database** once (choose *migrate*) to create the schema.
4. Deploy the app with the runtime env vars from §2.

Seed content is **not** imported to production. The JSON fixtures in `eval/fixtures/` are for
tests and local development only; production data is created by real users (and restored from
backups, §7).

## 5. Connection pooling

Every app instance opens a Prisma pool. Without limits, many instances can exhaust Neon's
`max_connections`. Control it with the pooled URL:

- `connection_limit=<n>` — max connections per Prisma client. Use a small number (e.g. `5`) on a
  long-lived host; use `1` on serverless.
- `pgbouncer=true` — tells Prisma it is behind a transaction pooler (disables prepared
  statements it cannot use).
- Always include `sslmode=require` against Neon.

The default Prisma limit is roughly `2 * CPU cores + 1`; on a large host that can climb quickly.
Verify the effective pool with:

```bash
npm run db:pool-check
# POOL_CHECK_CONCURRENCY=60 npm run db:pool-check
```

It fires concurrent queries and prints the requested concurrency, the configured
`connection_limit`, the server's `max_connections`, the **peak backends observed**, and the
elapsed time. It exits non-zero if any query fails. A peak well below `max_connections` means the
pool is doing its job.

## 6. Backups and PITR

Use two layers:

1. **Neon Point-in-Time Restore (primary).** Continuous, no setup. Retention depends on plan.
   Restore via the Neon console (**Branch → Restore**) or `neonctl`, which creates a new branch
   that you can promote or point staging at.
2. **Off-platform `pg_dump` (secondary).** Portable, provider-independent, good for disaster
   recovery and for loading a copy into staging.

```bash
# Full logical backup using the DIRECT (non-pooled) URL.
pg_dump "$DIRECT_URL" --format=custom --no-owner --file="historai-$(date +%Y%m%d-%H%M%S).dump"
```

Store dumps in durable object storage with a retention policy. Do not commit them.

## 7. Restore runbook

### A. Restore to a point in time (Neon)

1. Neon console → project → **Restore**.
2. Pick the timestamp (before the incident), name the branch, and restore.
3. Verify on the new branch:
   `psql "<branch-direct-url>" -c "select count(*) from \"User\";"`
4. Either promote the restored branch to the default branch, or point the app's
   `DATABASE_URL`/`DIRECT_URL` at it.
5. Run `npx prisma migrate status` to confirm the restored schema matches the deployed code.
6. Redeploy or restart the app, then smoke-test sign-in and the feed.

### B. Restore from a `pg_dump` file

```bash
createdb historai_restore                      # or a fresh Neon branch/database

# Restore the logical backup into the target.
pg_restore --no-owner --no-acl --dbname "postgresql://.../historai_restore" historai-YYYYmmdd-HHMMSS.dump

# Verify row counts before switching traffic.
psql "postgresql://.../historai_restore" -c "select count(*) from \"User\";"
```

Then point `DATABASE_URL`/`DIRECT_URL` at the restored database and restart the app.

### C. Staging restore drill (required once)

Phase 7 acceptance requires one documented, *performed* restore in staging. The scripted steps
below make the drill reproducible; a human with Neon access runs it.

1. Note a baseline in production: `User`, `Story`, and `Question` counts.
2. Create a staging branch from an earlier timestamp (or restore a `pg_dump` into staging).
3. Point a staging app instance at the restored branch and start it.
4. Verify: `npm run db:check`, `npx prisma migrate status`, sign-in, read a story, ask a question.
5. Record the outcome below and keep the evidence (screenshot / command output) with the release.

| Date | Performed by | Method | Baseline vs restored counts | Result | Notes |
|------|--------------|--------|-----------------------------|--------|-------|
| _pending_ | | | | | |

## 8. Security checklist

- `SESSION_SECRET` and `DATABASE_URL` are set in production (startup fails closed otherwise — D11).
- `SMTP_*` is configured in production so password resets send real email.
- Databases are not reachable from the public internet without TLS (`sslmode=require`).
- Repository secrets (`DATABASE_URL`, `DIRECT_URL`) are scoped to the environment and rotated if
  leaked.
- `SEED_USER_PASSWORD` and `npm run db:seed:test` are never run against production.
- `data/uploads/` is backed by persistent storage or pending the S3/R2 follow-up (D10).

## 9. Rollback

- **App rollback:** redeploy the previous build. Sessions are DB-backed, so users stay signed in.
- **Migration rollback:** Prisma migrations are forward-only. Restore to a point in time (§7.A),
  then redeploy the code that matches that schema. The committed seed fixtures live in
  `eval/fixtures/` for dev/test only; production data is restored from backups, not re-imported.

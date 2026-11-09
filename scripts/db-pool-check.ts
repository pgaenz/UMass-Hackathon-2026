/**
 * Connection-pool smoke check (plan/postgres-migration.md §6 Phase 7).
 *
 *   npm run db:pool-check
 *   POOL_CHECK_CONCURRENCY=50 npm run db:pool-check
 *   npx tsx scripts/db-pool-check.ts --concurrency=50
 *
 * Fires N concurrent queries at the database named by `DATABASE_URL` and samples
 * `pg_stat_activity` while they run. Prisma queues requests once the pool is
 * saturated (controlled by the `connection_limit` query parameter) rather than
 * failing, so this proves the app keeps serving concurrent requests and reports
 * the peak backend count against the server's `max_connections`.
 *
 * It is non-destructive: it only runs `SELECT ... pg_sleep(...)`.
 */
import { prisma } from "../lib/db";

const SLEEP_SECONDS = 0.25;

function parseConcurrency(): number {
  const arg = process.argv.find((value) => value.startsWith("--concurrency="));
  const raw = arg?.split("=")[1] ?? process.env.POOL_CHECK_CONCURRENCY ?? "25";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid concurrency "${raw}"; expected a positive integer.`);
  }
  return value;
}

function configuredConnectionLimit(): string {
  try {
    const limit = new URL(process.env.DATABASE_URL ?? "").searchParams.get("connection_limit");
    return limit ?? "(Prisma default)";
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scalar(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ value: number }[]>(sql);
  return Number(rows[0]?.value ?? 0);
}

async function main(): Promise<void> {
  const concurrency = parseConcurrency();
  const maxConnections = await scalar(
    "SELECT setting::int AS value FROM pg_settings WHERE name = 'max_connections'",
  );

  // Sample the open backend count while the burst is in flight.
  const samples: number[] = [];
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      try {
        samples.push(
          await scalar(
            "SELECT count(*)::int AS value FROM pg_stat_activity WHERE datname = current_database()",
          ),
        );
      } catch {
        // A sampling query that races shutdown should not fail the check.
      }
      await sleep(50);
    }
  })();

  const startedAt = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: concurrency }, () =>
      prisma.$queryRawUnsafe(`SELECT pg_sleep(${SLEEP_SECONDS})::text AS slept`),
    ),
  );
  const elapsedMs = Date.now() - startedAt;

  sampling = false;
  await sampler;

  const failed = results.filter((result) => result.status === "rejected");
  const peak = samples.length > 0 ? Math.max(...samples) : 0;

  console.log(`Concurrency requested : ${concurrency}`);
  console.log(`connection_limit param: ${configuredConnectionLimit()}`);
  console.log(`Server max_connections: ${maxConnections}`);
  console.log(`Peak backends observed: ${peak}`);
  console.log(`Burst completed in    : ${elapsedMs} ms`);
  console.log(`Queries failed        : ${failed.length}`);

  if (failed.length > 0) {
    for (const result of failed) {
      console.error(result.status === "rejected" ? result.reason : "");
    }
    process.exitCode = 1;
    return;
  }

  console.log("\nPool check OK: every concurrent query completed.");
}

main()
  .catch((error) => {
    console.error("\nPool check failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

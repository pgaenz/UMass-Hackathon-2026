/**
 * Connectivity check for the configured database.
 *
 *   npm run db:check
 *
 * Reports success with the server version, or a clear error and a non-zero exit
 * code when DATABASE_URL is missing or unreachable.
 */
import { prisma } from "../lib/db";

async function main(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    console.log("Database connection OK");
    console.log(rows[0]?.version ?? "(no version returned)");
  } catch (error) {
    console.error("Database connection failed");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();

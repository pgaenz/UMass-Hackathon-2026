import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient for the process.
 *
 * Next.js hot reload re-evaluates modules on every edit in development. Without
 * a global cache that creates a new connection pool per reload and eventually
 * exhausts Postgres ("too many clients"). Cache the client on `globalThis` in
 * development and reuse it across reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

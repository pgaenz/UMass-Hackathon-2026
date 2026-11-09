/**
 * Environment policy (plan D11).
 *
 * Production must fail closed: a deployment missing the database URL or the
 * session secret should not boot and silently run with a dev fallback. The
 * check is invoked from `instrumentation.ts` so it runs once at server start,
 * not on every request.
 */

const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "SESSION_SECRET"] as const;

/** Throws when production is missing a required secret; a no-op elsewhere. */
export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_IN_PRODUCTION.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start: missing required environment variable(s) in production: ${missing.join(", ")}.`,
    );
  }
}

/**
 * Next.js server entry point. `register()` runs once when the server starts, so
 * the production secret policy (D11) fails the deployment there instead of on
 * the first sign-in request.
 */
export async function register(): Promise<void> {
  const { assertProductionSecrets } = await import("@/lib/env");
  assertProductionSecrets();
}

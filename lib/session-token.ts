// Runtime-agnostic session cookie helpers. This module is imported by
// `middleware.ts`, which runs on the edge runtime, so it must not import
// `node:crypto` or touch the database.
//
// Sessions are opaque 32-byte tokens (D4). The raw token lives only in the
// httpOnly cookie; the database stores its SHA-256 hash. Middleware can
// therefore only check that a token of the expected shape is present — the
// authoritative lookup (row exists, not expired, not revoked, sessionVersion
// matches) happens in `lib/session.ts` on the Node runtime.

export const SESSION_COOKIE = "historai_session";

// Marks a read-only visitor so the home page does not bounce them back to
// /login. Not signed, not an identity — just "I chose to browse".
export const VISITOR_COOKIE = "historai_visitor";

// 32 random bytes encoded as base64url: 43 characters, A–Z a–z 0–9 - _.
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** True when the value looks like one of our opaque session tokens. */
export function isSessionToken(value: string | undefined | null): value is string {
  return typeof value === "string" && SESSION_TOKEN_PATTERN.test(value);
}

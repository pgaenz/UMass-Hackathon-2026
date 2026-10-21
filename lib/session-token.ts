// Pure, runtime-agnostic session token helpers (safe to import from middleware,
// which runs on the edge runtime and cannot use node:crypto).
import type { Role, SessionData } from "./types";

export const SESSION_COOKIE = "historai_session";

// Marks a read-only visitor so the home page does not bounce them back to
// /login. Not signed, not an identity — just "I chose to browse".
export const VISITOR_COOKIE = "historai_visitor";

// A server secret should be provided via SESSION_SECRET. The fallback keeps
// local `pnpm dev` working out of the box; production must set the real value.
const SECRET = process.env.SESSION_SECRET || "historai-dev-secret-change-me";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function isRole(value: unknown): value is Role {
  return value === "river" || value === "drop";
}

export async function createSessionToken(data: SessionData): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(data)));
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionData | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await sign(payload);
  if (!safeEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as {
      userId?: unknown;
      role?: unknown;
    };
    if (typeof parsed.userId === "string" && isRole(parsed.role)) {
      return { userId: parsed.userId, role: parsed.role };
    }
  } catch {
    // Malformed payload: treat as no session.
  }
  return null;
}

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "./db";
import { SESSION_COOKIE, VISITOR_COOKIE, isSessionToken } from "./session-token";
import type { Role, SessionData, User } from "./types";
import { getUser } from "./users";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const SESSION_TTL_MS = COOKIE_MAX_AGE * 1000;

/** The database stores only the SHA-256 hash of the opaque cookie token. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Best-effort request metadata for the session row. */
async function requestMeta(): Promise<{ userAgent: string | null; ip: string | null }> {
  try {
    const store = await headers();
    const forwarded = store.get("x-forwarded-for");
    return {
      userAgent: store.get("user-agent"),
      ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null,
    };
  } catch {
    return { userAgent: null, ip: null };
  }
}

/**
 * Reads and verifies the session cookie against the database. Safe during
 * render. Returns null when the token is missing/malformed, the row is gone,
 * expired, revoked, or was issued before the user's latest `sessionVersion`.
 *
 * This is the single authoritative check: `authorize()` and every page guard
 * route through it, so a revoked or expired session is rejected everywhere.
 */
export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!isSessionToken(token)) return null;

  const row = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: {
      user: { select: { id: true, role: true, sessionVersion: true } },
    },
  });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.sessionVersion !== row.user.sessionVersion) return null;

  return { userId: row.user.id, role: row.user.role };
}

/** True when this browser has chosen read-only visitor mode. */
export async function isVisitor(): Promise<boolean> {
  const store = await cookies();
  return store.get(VISITOR_COOKIE)?.value === "1";
}

/**
 * Resolves the signed-in user, if any. Returns null when there is no session or
 * the referenced user no longer exists (e.g. data reset).
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return getUser(session.userId);
}

/** Redirects to /login when there is no session. For server components only. */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/** Redirects unless the session has the given role. For server components only. */
export async function requireRole(role: Role): Promise<SessionData> {
  const session = await requireSession();
  if (session.role !== role) {
    redirect(session.role === "river" ? "/senior" : "/");
  }
  return session;
}

/**
 * Creates a server-side session row and sets the opaque cookie. Only valid
 * inside a route handler or server action.
 */
export async function setSession(data: SessionData): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { sessionVersion: true },
  });
  if (!user) {
    throw new Error("Cannot create a session for a missing user.");
  }

  const token = randomBytes(32).toString("base64url");
  const meta = await requestMeta();
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId: data.userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      sessionVersion: user.sessionVersion,
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  // A real identity supersedes the read-only visitor marker.
  store.delete(VISITOR_COOKIE);
}

/** Marks this browser as a read-only visitor. Route handler / server action only. */
export async function setVisitor(): Promise<void> {
  const store = await cookies();
  store.set(VISITOR_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/** Revokes the current session row and clears the cookie. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (isSessionToken(token)) {
    await prisma.session.updateMany({
      where: { id: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
  store.delete(VISITOR_COOKIE);
}

/**
 * API-route guard: returns the verified session, or a Response describing why
 * the request is not allowed. Callers should return the Response as-is.
 */
export async function authorize(
  roles: Role[],
): Promise<{ session: SessionData } | { response: Response }> {
  const session = await getSession();
  if (!session) {
    return {
      response: Response.json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }
  if (!roles.includes(session.role)) {
    return {
      response: Response.json(
        { error: "Your account cannot perform this action." },
        { status: 403 },
      ),
    };
  }
  return { session };
}

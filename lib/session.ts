import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  VISITOR_COOKIE,
  createSessionToken,
  verifySessionToken,
} from "./session-token";
import type { Role, SessionData, User } from "./types";
import { getUser } from "./users";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Reads and verifies the session cookie. Safe during render. */
export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
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

/** Sets the session cookie. Only valid inside a route handler or server action. */
export async function setSession(data: SessionData): Promise<void> {
  const token = await createSessionToken(data);
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

/** Clears the session cookie. Only valid inside a route handler or server action. */
export async function clearSession(): Promise<void> {
  const store = await cookies();
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

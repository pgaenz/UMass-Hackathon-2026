import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, VISITOR_COOKIE, isSessionToken } from "@/lib/session-token";

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence (plan §6 Phase 5). A browser always sends `Origin` on a
 * state-changing request, so a same-origin check is enough to stop a form on
 * another site from riding the httpOnly session cookie. Requests without an
 * `Origin` header (server-to-server, CLI, the test harness) carry no ambient
 * cookie and are allowed through.
 */
function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && originHost !== host) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }
  return null;
}

/**
 * Coarse route guard. The opaque session token carries no role and cannot be
 * verified on the edge, so this only checks presence/format and improves
 * navigation. Authoritative, full checks (DB row, expiry, revocation,
 * sessionVersion) run server-side via `lib/session.ts`, including the /senior
 * role gate in `requireRole`.
 */
export function middleware(request: NextRequest): NextResponse {
  const hasSession = isSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isVisitor = request.cookies.get(VISITOR_COOKIE)?.value === "1";
  const { pathname } = request.nextUrl;

  // Cross-origin checks run for every mutating API request, before auth.
  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method)) {
    const rejection = rejectCrossOrigin(request);
    if (rejection) return rejection;
  }

  const isHome = pathname === "/";
  const isRiverOnly = pathname === "/senior" || pathname.startsWith("/senior/");
  const isProfileSelf = pathname === "/profile";
  const isSignedInOnly =
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/connect";

  // First arrival: choose a role or continue as a read-only visitor.
  if (!hasSession && !isVisitor && isHome) {
    return redirectTo(request, "/login");
  }

  if (!hasSession && (isRiverOnly || isProfileSelf || isSignedInOnly)) {
    return redirectTo(request, "/login");
  }

  // Auth entry screens (/login, /onboarding) are intentionally NOT redirected
  // here. The token can outlive its session (expired, revoked, or data reset),
  // which would otherwise trap the browser: the header shows "Sign in" while
  // /login bounces home forever. The pages themselves check the real session
  // and redirect signed-in users away.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/",
    "/login",
    "/onboarding",
    "/profile",
    "/senior",
    "/senior/:path*",
    "/messages",
    "/messages/:path*",
    "/connect",
  ],
};

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, VISITOR_COOKIE, verifySessionToken } from "@/lib/session-token";

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

/**
 * Coarse route guard. Fine-grained, authoritative checks still run server-side
 * in API handlers — the middleware only improves navigation.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isVisitor = request.cookies.get(VISITOR_COOKIE)?.value === "1";
  const { pathname } = request.nextUrl;

  const isHome = pathname === "/";
  const isRiverOnly = pathname === "/senior" || pathname.startsWith("/senior/");
  const isProfileSelf = pathname === "/profile";

  // First arrival: choose a role or continue as a read-only visitor.
  if (!session && !isVisitor && isHome) {
    return redirectTo(request, "/login");
  }

  if (!session && (isRiverOnly || isProfileSelf)) {
    return redirectTo(request, "/login");
  }

  if (session && isRiverOnly && session.role !== "river") {
    return redirectTo(request, "/");
  }

  // Already signed in: no need to see the auth entry screens.
  if (session && (pathname === "/login" || pathname === "/onboarding")) {
    return redirectTo(request, "/");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/onboarding", "/profile", "/senior", "/senior/:path*"],
};

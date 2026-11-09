import { markEmailVerified } from "@/lib/auth";
import { recordAuthAudit } from "@/lib/auth-audit";

export const runtime = "nodejs";

const INVALID = "This verification link is invalid or has expired.";

// POST /api/auth/verify — consume an email-verification token.
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";

  const userId = token ? await markEmailVerified(token) : null;
  if (!userId) {
    return Response.json({ error: INVALID }, { status: 400 });
  }

  await recordAuthAudit("email.verified", userId);
  return Response.json({ ok: true });
}

import { resetPassword, validatePassword } from "@/lib/auth";
import { recordAuthAudit } from "@/lib/auth-audit";

export const runtime = "nodejs";

const INVALID = "This reset link is invalid or has expired. Request a new one.";

// POST /api/auth/password/reset — consume a reset token and set a new password.
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
    password?: unknown;
  } | null;

  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const passwordError = validatePassword(password);
  if (passwordError) {
    return Response.json({ error: passwordError }, { status: 400 });
  }

  const userId = token ? await resetPassword(token, password) : null;
  if (!userId) {
    return Response.json({ error: INVALID }, { status: 400 });
  }

  await recordAuthAudit("password.reset", userId);
  return Response.json({ ok: true });
}

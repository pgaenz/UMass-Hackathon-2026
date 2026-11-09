import { authenticate } from "@/lib/auth";
import { recordAuthAudit } from "@/lib/auth-audit";
import { setSession } from "@/lib/session";
import { toPublicUser } from "@/lib/users";

export const runtime = "nodejs";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

// POST /api/auth/login — sign in with an email and password (Phase 4).
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email.trim() || !password) {
    return fail(400, "Enter your email and password.");
  }

  const user = await authenticate(email, password);
  if (!user) {
    // Same message whether the email is unknown or the password is wrong.
    await recordAuthAudit("login.failure");
    return fail(401, "Invalid email or password.");
  }

  await setSession({ userId: user.id, role: user.role });
  await recordAuthAudit("login.success", user.id);
  return Response.json({ user: toPublicUser(user) });
}

import { changePassword, validatePassword } from "@/lib/auth";
import { recordAuthAudit } from "@/lib/auth-audit";
import { authorize, setSession } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/auth/password — change the signed-in user's password.
//
// Re-verifies the current password, rotates the hash, revokes every existing
// session, then issues a fresh session for the current device so the person who
// made the change stays signed in.
export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;

  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return Response.json({ error: passwordError }, { status: 400 });
  }

  const result = await changePassword(
    auth.session.userId,
    currentPassword,
    newPassword,
  );

  if (result === "wrong-password") {
    return Response.json({ error: "Your current password is incorrect." }, { status: 400 });
  }
  if (result === "missing-credential") {
    return Response.json(
      { error: "This account does not have a password yet." },
      { status: 400 },
    );
  }

  await setSession({ userId: auth.session.userId, role: auth.session.role });
  await recordAuthAudit("password.change", auth.session.userId);
  return Response.json({ ok: true });
}

import { createPasswordResetToken, isValidEmail, normalizeEmail } from "@/lib/auth";
import { recordAuthAudit } from "@/lib/auth-audit";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// POST /api/auth/password/forgot — start a password reset.
//
// Always answers `{ ok: true }` with status 200, whether or not the email is
// registered, so the endpoint cannot be used to enumerate accounts.
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";

  if (isValidEmail(email)) {
    const normalized = normalizeEmail(email);
    const credential = await prisma.credential.findUnique({
      where: { email: normalized },
      select: { userId: true },
    });

    if (credential) {
      try {
        const token = await createPasswordResetToken(credential.userId);
        const link = new URL("/reset-password", request.url);
        link.searchParams.set("token", token);
        await sendEmail({
          to: normalized,
          subject: "Reset your HistorAI password",
          text: `We received a request to reset your HistorAI password.\n\nOpen this link to choose a new one:\n${link}\n\nThe link expires in one hour and can be used once. If you did not ask for this, you can ignore this email.`,
        });
        await recordAuthAudit("password.forgot", credential.userId);
      } catch (err) {
        // Never surface delivery/audit failures — that would leak account state.
        console.error("Password reset request failed:", err);
      }
    }
  }

  return Response.json({ ok: true });
}

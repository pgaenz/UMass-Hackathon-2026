import { createEmailVerificationToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { authorize } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/auth/verify/resend — send a fresh verification link to the
// signed-in user. Used when the first email was lost or never arrived.
export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const credential = await prisma.credential.findUnique({
    where: { userId: auth.session.userId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!credential) {
    return Response.json(
      { error: "This account does not have an email address yet." },
      { status: 400 },
    );
  }
  if (credential.emailVerifiedAt) {
    return Response.json({ ok: true, alreadyVerified: true });
  }

  try {
    const token = await createEmailVerificationToken(auth.session.userId);
    const link = new URL("/verify-email", request.url);
    link.searchParams.set("token", token);
    await sendEmail({
      to: credential.email,
      subject: "Verify your HistorAI email",
      text: `Confirm this address to finish setting up your HistorAI account:\n\n${link}\n\nThe link expires in 24 hours and can be used once. If you did not create an account, you can ignore this email.`,
    });
  } catch (err) {
    console.error("Verification email failed:", err);
    return Response.json(
      { error: "We could not send the verification email. Please try again later." },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}

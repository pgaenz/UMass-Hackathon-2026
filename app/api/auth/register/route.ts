import { ageRequirement, isValidAgeForRole } from "@/lib/age";
import { checkSafety } from "@/lib/agents";
import {
  EmailTakenError,
  createEmailVerificationToken,
  isValidEmail,
  registerUser,
  validatePassword,
} from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { setSession } from "@/lib/session";
import { toPublicUser } from "@/lib/users";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function isRole(value: unknown): value is Role {
  return value === "river" || value === "drop";
}

function cleanInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      unique.add(item.trim());
    }
  }
  return [...unique].slice(0, 20);
}

// POST /api/auth/register — create a User + Credential and start a session.
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
    name?: unknown;
    age?: unknown;
    bio?: unknown;
    interests?: unknown;
    email?: unknown;
    password?: unknown;
  } | null;

  if (!isRole(body?.role)) {
    return fail(400, "Choose whether you are a River or a Drop.");
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return fail(400, "Please enter your name.");
  }
  if (name.length > 80) {
    return fail(400, "That name is too long.");
  }

  const age = typeof body?.age === "number" ? body.age : Number(body?.age);
  if (!isValidAgeForRole(age, body.role)) {
    return fail(400, ageRequirement(body.role));
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!isValidEmail(email)) {
    return fail(400, "Please enter a valid email address.");
  }

  const password = typeof body?.password === "string" ? body.password : "";
  const passwordError = validatePassword(password);
  if (passwordError) {
    return fail(400, passwordError);
  }

  // Safety gate: a display name is public and cannot be auto-cleaned, so any
  // flagged name is rejected rather than rewritten.
  try {
    const safety = await checkSafety({ content: name, kind: "name" });
    if (safety.verdict !== "allow") {
      return fail(
        422,
        safety.summary || "That name cannot be used. Please choose a different one.",
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "We could not create your profile.";
    return fail(
      err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500,
      message,
    );
  }

  const bio = typeof body?.bio === "string" ? body.bio.trim().slice(0, 300) : "";

  try {
    const user = await registerUser({
      role: body.role,
      name,
      age,
      bio,
      interests: cleanInterests(body?.interests),
      email,
      password,
    });

    await setSession({ userId: user.id, role: user.role });

    // Send the verification link, but never fail registration if delivery does.
    // The signed-in user can request a new link from /api/auth/verify/resend.
    try {
      const token = await createEmailVerificationToken(user.id);
      const link = new URL("/verify-email", request.url);
      link.searchParams.set("token", token);
      await sendEmail({
        to: email,
        subject: "Verify your HistorAI email",
        text: `Welcome to HistorAI! Confirm this address to finish setting up your account:\n\n${link}\n\nThe link expires in 24 hours and can be used once. If you did not create an account, you can ignore this email.`,
      });
    } catch (err) {
      console.error("Verification email failed:", err);
    }

    return Response.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return fail(409, err.message);
    }
    throw err;
  }
}

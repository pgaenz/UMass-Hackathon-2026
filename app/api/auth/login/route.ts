import { checkSafety } from "@/lib/agents";
import { setSession } from "@/lib/session";
import { createUser, isValidAge, toPublicUser } from "@/lib/users";
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

// POST /api/auth/login — passwordless start: role + profile, sets the session.
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
    name?: unknown;
    age?: unknown;
    bio?: unknown;
    interests?: unknown;
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
  if (!isValidAge(age)) {
    return fail(400, "Please enter a valid age (13 or older).");
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

  const user = await createUser({
    role: body.role,
    name,
    age,
    bio,
    interests: cleanInterests(body?.interests),
  });

  await setSession({ userId: user.id, role: user.role });
  return Response.json({ user: toPublicUser(user) }, { status: 201 });
}

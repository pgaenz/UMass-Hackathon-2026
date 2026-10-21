import { authorize } from "@/lib/session";
import { isValidAge, toPublicUser, updateUser } from "@/lib/users";
import type { User } from "@/lib/types";

export const runtime = "nodejs";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function cleanInterests(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      unique.add(item.trim());
    }
  }
  return [...unique].slice(0, 20);
}

// PATCH /api/auth/profile — edit the signed-in user's own profile.
export async function PATCH(request: Request): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    age?: unknown;
    bio?: unknown;
    interests?: unknown;
  } | null;

  const patch: Partial<User> = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail(400, "Please enter your name.");
    if (name.length > 80) return fail(400, "That name is too long.");
    patch.name = name;
  }

  if (body?.age !== undefined) {
    const age = typeof body.age === "number" ? body.age : Number(body.age);
    if (!isValidAge(age)) return fail(400, "Please enter a valid age (13 or older).");
    patch.age = age;
  }

  if (body?.bio !== undefined) {
    patch.bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 300) : "";
  }

  const interests = cleanInterests(body?.interests);
  if (interests !== undefined) {
    patch.interests = interests;
  }

  const updated = await updateUser(auth.session.userId, patch);
  if (!updated) {
    return fail(404, "We could not find your profile.");
  }
  return Response.json({ user: toPublicUser(updated) });
}

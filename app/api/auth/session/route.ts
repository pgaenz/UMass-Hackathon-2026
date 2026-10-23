import { setSession } from "@/lib/session";
import { getUser, toPublicUser } from "@/lib/users";

export const runtime = "nodejs";

// POST /api/auth/session  { userId }
// Passwordless demo sign-in to an existing profile (see plan/UX-FIXES-2.md §7).
// This intentionally trusts the caller: there are no passwords, no email, and no
// private data. It must be replaced by real authentication before any launch.
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return Response.json({ error: "Pick a profile to continue." }, { status: 400 });
  }

  const user = await getUser(userId);
  if (!user) {
    return Response.json({ error: "We could not find that profile." }, { status: 404 });
  }

  await setSession({ userId: user.id, role: user.role });
  return Response.json({ user: toPublicUser(user) });
}

import { clearSession } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/auth/logout — clears the session cookie.
export async function POST(): Promise<Response> {
  await clearSession();
  return Response.json({ ok: true });
}

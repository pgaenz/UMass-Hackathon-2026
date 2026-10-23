import { countUnread } from "@/lib/chat";
import { authorize } from "@/lib/session";

export const runtime = "nodejs";

// GET /api/chat/unread — cheap header badge.
export async function GET(): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const count = await countUnread(auth.session.userId);
  return Response.json({ count });
}

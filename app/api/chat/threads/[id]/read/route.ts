import { getThread, isParticipant, markThreadRead } from "@/lib/chat";
import { authorize } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/chat/threads/[id]/read — mark the thread read for the current user.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) {
    return Response.json({ error: "That conversation could not be found." }, { status: 404 });
  }
  if (!isParticipant(thread, auth.session.userId)) {
    return Response.json({ error: "You are not part of this conversation." }, { status: 403 });
  }

  const unreadCount = await markThreadRead(id, auth.session.userId);
  return Response.json({ unreadCount });
}

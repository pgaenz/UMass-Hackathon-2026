import { blockUser, getThread, isParticipant, otherParticipantId } from "@/lib/chat";
import { authorize } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/chat/threads/[id]/block — block the other person and close the thread.
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

  const blockedId = otherParticipantId(thread, auth.session.userId);
  await blockUser(auth.session.userId, blockedId);
  return Response.json({ ok: true });
}

import { canMessage, getOrCreateThread, getThreadByPair, listThreadsForUser } from "@/lib/chat";
import { authorize } from "@/lib/session";
import { getUser } from "@/lib/users";

export const runtime = "nodejs";

// GET /api/chat/threads — inbox for the signed-in user.
export async function GET(): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const threads = await listThreadsForUser(auth.session.userId);
  return Response.json({ threads });
}

// POST /api/chat/threads  { participantId } — get or create a 1:1 thread.
export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { participantId?: unknown } | null;
  const participantId =
    typeof body?.participantId === "string" ? body.participantId.trim() : "";

  if (!participantId) {
    return Response.json({ error: "Missing participant id." }, { status: 400 });
  }
  if (participantId === auth.session.userId) {
    return Response.json({ error: "You cannot message yourself." }, { status: 400 });
  }

  const [me, other] = await Promise.all([
    getUser(auth.session.userId),
    getUser(participantId),
  ]);
  if (!me || !other) {
    return Response.json({ error: "That person could not be found." }, { status: 404 });
  }
  const existing = await getThreadByPair(me.id, other.id);
  if (!existing && !canMessage(me, other)) {
    return Response.json(
      { error: "You cannot start a conversation with this person." },
      { status: 403 },
    );
  }

  const thread = await getOrCreateThread(me, other);
  return Response.json({ thread }, { status: existing ? 200 : 201 });
}

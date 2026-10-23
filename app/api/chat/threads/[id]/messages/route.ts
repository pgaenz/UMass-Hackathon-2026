import {
  appendMessage,
  getOtherParticipant,
  getThread,
  getThreadMessages,
  isBlocked,
  isParticipant,
  toMessageView,
} from "@/lib/chat";
import { rateLimitReason, screenMessage } from "@/lib/chat-safety";
import { authorize } from "@/lib/session";

export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 2_000;

const CRISIS_MESSAGE =
  "It sounds like you may be going through something heavy. You are not alone — " +
  "in the US you can call or text 988 (Suicide & Crisis Lifeline) any time, or contact " +
  "your local emergency number. This message was not delivered.";

// GET /api/chat/threads/[id]/messages?after=<messageId>
export async function GET(
  request: Request,
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

  const other = await getOtherParticipant(thread, auth.session.userId);
  if (!other) {
    return Response.json({ error: "That conversation could not be found." }, { status: 404 });
  }

  const after = new URL(request.url).searchParams.get("after") ?? undefined;
  const messages = await getThreadMessages(id, auth.session.userId, after);
  const blocked = await isBlocked(auth.session.userId, other.id);

  return Response.json({
    threadId: id,
    other,
    messages,
    blocked,
    canSend: !blocked && thread.status === "active",
  });
}

// POST /api/chat/threads/[id]/messages  { body } — screen, then store.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const rateError = rateLimitReason(auth.session.userId);
  if (rateError) {
    return Response.json({ error: rateError }, { status: 429 });
  }

  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) {
    return Response.json({ error: "That conversation could not be found." }, { status: 404 });
  }
  if (!isParticipant(thread, auth.session.userId)) {
    return Response.json({ error: "You are not part of this conversation." }, { status: 403 });
  }

  const other = await getOtherParticipant(thread, auth.session.userId);
  if (!other) {
    return Response.json({ error: "That conversation could not be found." }, { status: 404 });
  }
  if (await isBlocked(auth.session.userId, other.id)) {
    return Response.json({ error: "This conversation is closed." }, { status: 403 });
  }
  if (thread.status !== "active") {
    return Response.json({ error: "This conversation is closed." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return Response.json({ error: "Write a message before sending." }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    return Response.json({ error: "That message is too long." }, { status: 400 });
  }

  // Safety runs BEFORE persistence: a blocked message is never written.
  const safety = await screenMessage(text);
  if (safety.verdict === "block") {
    if (safety.flags.includes("crisis")) {
      console.warn(`[chat-safety] crisis language from ${auth.session.userId}`);
      return Response.json({ error: CRISIS_MESSAGE, flags: safety.flags, crisis: true }, { status: 422 });
    }
    return Response.json(
      {
        error:
          "We could not deliver that message. It looks like it may share private information or be unsafe. Please rewrite it.",
        flags: safety.flags,
      },
      { status: 422 },
    );
  }

  const message = await appendMessage(id, auth.session.userId, text, safety);
  if (!message) {
    return Response.json({ error: "That conversation could not be found." }, { status: 404 });
  }

  return Response.json({ message: toMessageView(message, auth.session.userId) }, { status: 201 });
}

import { openAudioChat } from "@/lib/audio-chat";
import { base64FromBuffer } from "@/lib/audio";
import { config } from "@/lib/config";
import { buildGreetingMessages } from "@/lib/conversation-context";
import { appendTurn, getConversation } from "@/lib/conversations";
import { authorize } from "@/lib/session";
import { sseResponse } from "@/lib/sse";

export const runtime = "nodejs";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function errorStatus(err: unknown): number {
  return err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500;
}

// POST /api/conversation/[id]/greet — streams the opening assistant turn.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return fail(404, "Unknown conversation");
  }
  if (conversation.userId && conversation.userId !== auth.session.userId) {
    return fail(403, "This conversation belongs to another River.");
  }
  if (conversation.status !== "active") {
    return fail(409, "This conversation has already ended");
  }
  if (conversation.turns.length > 0) {
    return fail(409, "This conversation has already started");
  }

  let upstream;
  try {
    const messages = await buildGreetingMessages(conversation);
    upstream = await openAudioChat(messages, request.signal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start the conversation";
    return fail(errorStatus(err), message);
  }

  return sseResponse(request.signal, async (send, signal) => {
    let assistantText = "";
    let usage: unknown = null;

    for await (const event of upstream.events) {
      if (signal.aborted) break;
      if (event.type === "text") {
        assistantText += event.text;
        send("assistant_delta", { text: event.text });
      } else if (event.type === "audio") {
        send("audio", {
          data: base64FromBuffer(event.data),
          sampleRate: config.audioSampleRate,
        });
      } else if (event.type === "usage") {
        usage = event.usage;
      }
    }

    const appended = await appendTurn(id, {
      assistant: { text: assistantText.trim(), interrupted: false },
    });
    send("done", {
      turn: appended?.turn ?? null,
      assistantText: assistantText.trim(),
      usage,
    });
  });
}

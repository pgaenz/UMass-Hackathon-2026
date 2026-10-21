import {
  compileConversationContext,
  compileSeniorTranscript,
  getConversation,
  setConversationStatus,
} from "@/lib/conversations";
import { getStory, updateStory } from "@/lib/store";

export const runtime = "nodejs";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

// POST /api/conversation/[id]/end
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return fail(404, "Unknown conversation");
  }

  const story = await getStory(conversation.storyId);
  if (!story) {
    return fail(404, "Unknown story");
  }

  if (conversation.status === "ended") {
    return Response.json({ conversation, story });
  }

  const transcript = compileSeniorTranscript(conversation);
  if (!transcript.trim()) {
    return fail(409, "The senior has not said anything yet");
  }

  const conversationContext = compileConversationContext(conversation);

  const [ended, updatedStory] = await Promise.all([
    setConversationStatus(id, "ended"),
    updateStory(story.id, {
      transcript,
      conversationContext,
      inputType: "conversation",
      rawAudioPath: story.rawAudioPath,
    }),
  ]);

  return Response.json({
    conversation: ended ?? { ...conversation, status: "ended" },
    story: updatedStory ?? { ...story, transcript, conversationContext },
  });
}

import { createConversation } from "@/lib/conversations";
import { getQuestion, linkStoryToQuestion } from "@/lib/questions";
import { authorize } from "@/lib/session";
import { createStory, updateStory } from "@/lib/store";

export const runtime = "nodejs";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

// POST /api/conversation  { prompt, questionId? }
export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["river"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown;
    questionId?: unknown;
  } | null;

  const rawQuestionId =
    typeof body?.questionId === "string" ? body.questionId.trim() : "";
  const question = rawQuestionId ? await getQuestion(rawQuestionId) : null;
  if (rawQuestionId && !question) {
    return fail(400, "Unknown question");
  }

  const providedPrompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const prompt = providedPrompt || question?.text || "";
  if (!prompt) {
    return fail(400, "Missing conversation prompt");
  }

  const questionId = question?.id ?? null;
  const story = await createStory({
    inputType: "conversation",
    prompt,
    questionId,
    authorId: auth.session.userId,
  });

  if (questionId) {
    await linkStoryToQuestion(questionId, story.id);
  }

  const conversation = await createConversation({
    storyId: story.id,
    prompt,
    questionId,
    userId: auth.session.userId,
  });

  const linkedStory = await updateStory(story.id, { conversationId: conversation.id });
  return Response.json({ conversation, story: linkedStory ?? story }, { status: 201 });
}

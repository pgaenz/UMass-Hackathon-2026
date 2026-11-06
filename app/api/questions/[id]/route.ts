import { validateQuestionText, validateQuestionTopics } from "@/lib/question-rules";
import { deleteQuestion, getQuestion, getTopics, updateQuestion } from "@/lib/questions";
import { screenQuestionText } from "@/lib/question-safety";
import { authorize } from "@/lib/session";
import { getAllStories } from "@/lib/store";

export const runtime = "nodejs";

const LINKED_MESSAGE =
  "A River has started an answer, so this question can no longer be changed.";

/** A question may be edited or withdrawn only while no story is linked (D3/D4). */
async function hasLinkedStory(question: {
  id: string;
  storyIds: string[];
}): Promise<boolean> {
  const stories = await getAllStories();
  return stories.some(
    (story) =>
      story.questionId === question.id || question.storyIds.includes(story.id),
  );
}

// PATCH /api/questions/[id]  { text?, topicIds? } — owner only.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["drop"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const question = await getQuestion(id);
  if (!question) {
    return Response.json({ error: "Unknown question" }, { status: 404 });
  }
  if (question.askedBy !== auth.session.userId) {
    return Response.json({ error: "This question belongs to another Drop." }, { status: 403 });
  }
  if (await hasLinkedStory(question)) {
    return Response.json({ error: LINKED_MESSAGE }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    topicIds?: unknown;
  } | null;

  if (!body || (body.text === undefined && body.topicIds === undefined)) {
    return Response.json({ error: "There is nothing to save." }, { status: 400 });
  }

  const patch: { text?: string; topicIds?: string[]; editedAt?: string } = {};
  let notice: string | undefined;

  if (body.text !== undefined) {
    const textCheck = validateQuestionText(body.text);
    if (!textCheck.ok) {
      return Response.json({ error: textCheck.error }, { status: 400 });
    }
    try {
      const screening = await screenQuestionText(textCheck.text);
      if (!screening.ok) {
        return Response.json({ error: screening.error }, { status: screening.status });
      }
      patch.editedAt = new Date().toISOString();
      patch.text = screening.text;
      notice = screening.notice;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "We could not check your question.";
      const status =
        err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500;
      return Response.json({ error: message }, { status });
    }
  }

  if (body.topicIds !== undefined) {
    const topics = await getTopics();
    const topicCheck = validateQuestionTopics(
      body.topicIds,
      topics.map((topic) => topic.id),
    );
    if (!topicCheck.ok) {
      return Response.json({ error: topicCheck.error }, { status: 400 });
    }
    patch.topicIds = topicCheck.topicIds;
  }

  const updated = await updateQuestion(id, patch);
  return Response.json({ question: updated, notice });
}

// DELETE /api/questions/[id] — withdraw, owner only, no linked story.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["drop"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const question = await getQuestion(id);
  if (!question) {
    return Response.json({ error: "Unknown question" }, { status: 404 });
  }
  if (question.askedBy !== auth.session.userId) {
    return Response.json({ error: "This question belongs to another Drop." }, { status: 403 });
  }
  if (await hasLinkedStory(question)) {
    return Response.json({ error: LINKED_MESSAGE }, { status: 409 });
  }

  await deleteQuestion(id);
  return Response.json({ deleted: true, id });
}

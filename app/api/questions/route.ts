import { validateQuestionText, validateQuestionTopics } from "@/lib/question-rules";
import { createQuestion, getQuestions, getTopics } from "@/lib/questions";
import { screenQuestionText } from "@/lib/question-safety";
import { authorize } from "@/lib/session";

export const runtime = "nodejs";

// GET /api/questions?topic=<topicId>
export async function GET(request: Request): Promise<Response> {
  const topic = new URL(request.url).searchParams.get("topic") ?? undefined;
  const [questions, topics] = await Promise.all([getQuestions(topic), getTopics()]);
  return Response.json({ questions, topics });
}

// POST /api/questions  { text, topicIds? } — Drops ask the questions.
export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["drop"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    topicIds?: unknown;
  } | null;

  const textCheck = validateQuestionText(body?.text);
  if (!textCheck.ok) {
    return Response.json({ error: textCheck.error }, { status: 400 });
  }

  const topics = await getTopics();
  const topicCheck = validateQuestionTopics(
    body?.topicIds,
    topics.map((topic) => topic.id),
  );
  if (!topicCheck.ok) {
    return Response.json({ error: topicCheck.error }, { status: 400 });
  }

  try {
    // Safety gate: nothing is posted unless it is family-friendly.
    const screening = await screenQuestionText(textCheck.text);
    if (!screening.ok) {
      return Response.json({ error: screening.error }, { status: screening.status });
    }

    // The author is always taken from the session, never the request body.
    const question = await createQuestion({
      text: screening.text,
      topicIds: topicCheck.topicIds,
      askedBy: auth.session.userId,
    });
    return Response.json({ question, notice: screening.notice }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "We could not post your question.";
    const status = err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500;
    return Response.json({ error: message }, { status });
  }
}

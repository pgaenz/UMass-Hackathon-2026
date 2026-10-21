import { createQuestion, getQuestions, getTopics } from "@/lib/questions";
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

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "Missing question text" }, { status: 400 });
  }

  const topicIds = Array.isArray(body?.topicIds)
    ? body.topicIds.filter((topic): topic is string => typeof topic === "string")
    : [];

  // The author is always taken from the session, never the request body.
  const question = await createQuestion({ text, topicIds, askedBy: auth.session.userId });
  return Response.json({ question }, { status: 201 });
}

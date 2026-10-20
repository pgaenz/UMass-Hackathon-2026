import { createQuestion, getQuestions, getTopics } from "@/lib/questions";

export const runtime = "nodejs";

// GET /api/questions?topic=<topicId>
export async function GET(request: Request): Promise<Response> {
  const topic = new URL(request.url).searchParams.get("topic") ?? undefined;
  const [questions, topics] = await Promise.all([getQuestions(topic), getTopics()]);
  return Response.json({ questions, topics });
}

// POST /api/questions  { text, topicIds?, askedBy? }
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    topicIds?: unknown;
    askedBy?: unknown;
  } | null;

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "Missing question text" }, { status: 400 });
  }

  const topicIds = Array.isArray(body?.topicIds)
    ? body.topicIds.filter((topic): topic is string => typeof topic === "string")
    : [];
  const askedBy = typeof body?.askedBy === "string" ? body.askedBy : null;

  const question = await createQuestion({ text, topicIds, askedBy });
  return Response.json({ question }, { status: 201 });
}

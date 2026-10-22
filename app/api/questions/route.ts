import { checkSafety, rewriteForSafety } from "@/lib/agents";
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

  try {
    // Safety gate: nothing is posted unless it is family-friendly.
    const safety = await checkSafety({ content: text, kind: "question" });
    if (safety.verdict === "block") {
      return Response.json(
        {
          error:
            safety.summary || "That question cannot be posted. Please ask something different.",
        },
        { status: 422 },
      );
    }

    let questionText = text;
    let notice: string | undefined;

    if (safety.verdict === "revise") {
      const cleaned = await rewriteForSafety({ content: text, kind: "question", safety });
      if (!cleaned) {
        return Response.json(
          { error: "That question cannot be posted as written. Please ask something different." },
          { status: 422 },
        );
      }
      const recheck = await checkSafety({ content: cleaned, kind: "question" });
      if (recheck.verdict !== "allow") {
        return Response.json(
          {
            error:
              recheck.summary ||
              "That question cannot be posted. Please ask something different.",
          },
          { status: 422 },
        );
      }
      questionText = cleaned;
      notice = "We cleaned up your question a little before posting it.";
    }

    // The author is always taken from the session, never the request body.
    const question = await createQuestion({
      text: questionText,
      topicIds,
      askedBy: auth.session.userId,
    });
    return Response.json({ question, notice }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "We could not post your question.";
    const status = err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500;
    return Response.json({ error: message }, { status });
  }
}

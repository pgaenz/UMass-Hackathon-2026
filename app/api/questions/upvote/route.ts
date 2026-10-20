import { upvoteQuestion } from "@/lib/questions";

export const runtime = "nodejs";

// POST /api/questions/upvote  { id }
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return Response.json({ error: "Missing question id" }, { status: 400 });
  }

  const question = await upvoteQuestion(id);
  if (!question) {
    return Response.json({ error: "Unknown question" }, { status: 404 });
  }
  return Response.json({ question });
}

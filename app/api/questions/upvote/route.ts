import { isVoted, setVote } from "@/lib/question-votes";
import { adjustUpvotes, getQuestion } from "@/lib/questions";
import { authorize } from "@/lib/session";
import type { VoteQuestionResponse } from "@/lib/types";

export const runtime = "nodejs";

// POST /api/questions/upvote  { id, vote? }
// `vote` may be true (upvote) or false (un-vote). Omit it to toggle.
// Upvotes are per-user (see plan/UX-FIXES-2.md §6), not per-browser.
export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    vote?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return Response.json({ error: "Missing question id" }, { status: 400 });
  }

  const question = await getQuestion(id);
  if (!question) {
    return Response.json({ error: "Unknown question" }, { status: 404 });
  }

  const desired =
    typeof body?.vote === "boolean"
      ? body.vote
      : !(await isVoted(id, auth.session.userId));

  const delta = await setVote(id, auth.session.userId, desired);
  const count =
    delta === 0 ? question.upvotes : (await adjustUpvotes(id, delta)) ?? question.upvotes;

  const payload: VoteQuestionResponse = { voted: desired, count };
  return Response.json(payload);
}

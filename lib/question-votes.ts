import { prisma } from "./db";
import type { QuestionVoteState } from "./types";

export async function countVotes(questionId: string): Promise<number> {
  return prisma.questionVote.count({ where: { questionId } });
}

export async function isVoted(questionId: string, userId: string): Promise<boolean> {
  const row = await prisma.questionVote.findUnique({
    where: { questionId_userId: { questionId, userId } },
    select: { questionId: true },
  });
  return row !== null;
}

/**
 * Batch state for a page of questions in one read, so lists never do N+1
 * lookups. Only the viewer's own vote is needed; the displayed count is the
 * denormalized `question.upvotes`. `viewerId` is null for visitors.
 */
export async function getVoteStates(
  questionIds: string[],
  viewerId: string | null,
): Promise<Record<string, QuestionVoteState>> {
  const states: Record<string, QuestionVoteState> = {};
  for (const id of questionIds) {
    states[id] = { voted: false };
  }
  if (!viewerId || questionIds.length === 0) return states;

  const rows = await prisma.questionVote.findMany({
    where: { userId: viewerId, questionId: { in: questionIds } },
    select: { questionId: true },
  });
  for (const row of rows) {
    states[row.questionId].voted = true;
  }
  return states;
}

/**
 * Idempotent set: add the vote if absent, remove it if present. Unique on
 * (questionId, userId) so the count can never be inflated by double clicks.
 *
 * Returns the change in the number of stored votes: `+1` (added), `-1`
 * (removed), or `0` (already in the desired state). Callers apply the same
 * delta to the denormalized `question.upvotes`.
 */
export async function setVote(
  questionId: string,
  userId: string,
  voted: boolean,
): Promise<number> {
  if (voted) {
    // `createMany` uses INSERT ... ON CONFLICT DO NOTHING, so concurrent
    // requests cannot race into a duplicate-key error.
    const result = await prisma.questionVote.createMany({
      data: [{ questionId, userId }],
      skipDuplicates: true,
    });
    return result.count > 0 ? 1 : 0;
  }

  const result = await prisma.questionVote.deleteMany({ where: { questionId, userId } });
  return result.count > 0 ? -1 : 0;
}

/** Removes every stored vote for a withdrawn question. */
export async function removeVotesForQuestion(questionId: string): Promise<number> {
  const result = await prisma.questionVote.deleteMany({ where: { questionId } });
  return result.count;
}

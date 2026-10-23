import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import type { QuestionVote, QuestionVoteState } from "./types";

interface VotesData {
  votes: QuestionVote[];
}

const VOTES_PATH = path.join(process.cwd(), "data", "question-votes.json");
const EMPTY: VotesData = { votes: [] };

function normalize(parsed: Partial<VotesData>): VotesData {
  const votes = Array.isArray(parsed.votes) ? parsed.votes : [];
  return {
    votes: votes
      .filter(
        (vote): vote is QuestionVote =>
          Boolean(vote) &&
          typeof vote.questionId === "string" &&
          typeof vote.userId === "string",
      )
      .map((vote) => ({
        ...vote,
        createdAt:
          typeof vote.createdAt === "string" ? vote.createdAt : new Date(0).toISOString(),
      })),
  };
}

async function readStore(): Promise<VotesData> {
  return normalize(await readJson<VotesData>(VOTES_PATH, EMPTY));
}

export async function countVotes(questionId: string): Promise<number> {
  const { votes } = await readStore();
  return votes.filter((vote) => vote.questionId === questionId).length;
}

export async function isVoted(questionId: string, userId: string): Promise<boolean> {
  const { votes } = await readStore();
  return votes.some((vote) => vote.questionId === questionId && vote.userId === userId);
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
  if (!viewerId) return states;

  const wanted = new Set(questionIds);
  const { votes } = await readStore();
  for (const vote of votes) {
    if (vote.userId === viewerId && wanted.has(vote.questionId)) {
      states[vote.questionId].voted = true;
    }
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
  let delta = 0;
  await mutateJson<VotesData>(VOTES_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.votes.findIndex(
      (vote) => vote.questionId === questionId && vote.userId === userId,
    );
    if (voted && index === -1) {
      data.votes.push({ questionId, userId, createdAt: new Date().toISOString() });
      delta = 1;
    } else if (!voted && index !== -1) {
      data.votes.splice(index, 1);
      delta = -1;
    }
    return data;
  });
  return delta;
}

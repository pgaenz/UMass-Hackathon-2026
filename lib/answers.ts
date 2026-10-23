import { getAllStories } from "./store";
import type { Question, Story } from "./types";

/** Published answers only — drafts must never leak into reader-facing pages. */
export async function getPublishedStories(): Promise<Story[]> {
  const stories = await getAllStories();
  return stories
    .filter((story) => story.status === "published")
    // Defense in depth: a hard safety block can never reach the feed.
    .filter((story) => story.safety?.verdict !== "block")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countAnswersByQuestion(stories: Story[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const story of stories) {
    if (!story.questionId) continue;
    counts[story.questionId] = (counts[story.questionId] ?? 0) + 1;
  }
  return counts;
}

/**
 * Canonical topic ids for an answer, taken from the question it responds to.
 * Answers with no linked question have no topics (legacy/demo content).
 */
export function answerTopics(story: Story, question: Question | null | undefined): string[] {
  return question?.topicIds ?? [];
}

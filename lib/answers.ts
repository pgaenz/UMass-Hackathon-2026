import { getAllStories } from "./store";
import type { Story } from "./types";

/** Published answers only — drafts must never leak into reader-facing pages. */
export async function getPublishedStories(): Promise<Story[]> {
  const stories = await getAllStories();
  return stories
    .filter((story) => story.status === "published")
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

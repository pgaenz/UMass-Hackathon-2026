import type { Question, Story } from "./types";

export type DropQuestionStateId = "answered" | "in_progress" | "waiting";

export interface DropQuestionState {
  id: DropQuestionStateId;
  label: string;
  /** First published linked story, newest first, for "Read the story". */
  storyId: string | null;
  storyCount: number;
  edited: boolean;
  hasTopics: boolean;
}

/**
 * One pure helper for every Drop-facing question state (plan §5).
 * `linkedStories` must include drafts, not only published stories.
 */
export function deriveDropQuestionState(
  question: Question,
  linkedStories: Story[],
): DropQuestionState {
  const linked = linkedStories.filter(
    (story) =>
      story.questionId === question.id || question.storyIds.includes(story.id),
  );
  const published = linked
    .filter((story) => story.status === "published")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const edited = Boolean(question.editedAt);
  const hasTopics = question.topicIds.length > 0;

  if (published.length > 0) {
    const count = published.length;
    return {
      id: "answered",
      label: `Answered · ${count} ${count === 1 ? "story" : "stories"}`,
      storyId: published[0].id,
      storyCount: count,
      edited,
      hasTopics,
    };
  }

  if (linked.length > 0) {
    return {
      id: "in_progress",
      label: "A River is writing an answer",
      storyId: null,
      storyCount: 0,
      edited,
      hasTopics,
    };
  }

  return {
    id: "waiting",
    label: "Waiting for a River",
    storyId: null,
    storyCount: 0,
    edited,
    hasTopics,
  };
}

import type { Story } from "./types";

/**
 * One pure helper maps a Story to the single River-facing state used by the
 * overview, the review page, the profile list, and the question cards.
 * See plan/river-experience.md §5.
 */

export type RiverStoryStateId =
  | "published"
  | "answer_saved"
  | "blocked"
  | "needs_check"
  | "needs_changes"
  | "ready";

export interface RiverStoryState {
  id: RiverStoryStateId;
  /** Plain-language label shown to the River. */
  label: string;
  /** Primary call to action for this state. */
  primaryAction: string;
  /**
   * True when the River corrected the answer after the current story was
   * written. Shown on top of any state. Legacy records without a stored hash
   * are never flagged.
   */
  answerChangedSinceWriting: boolean;
}

/** Stable, dependency-free hash so the same value can be computed on client or server. */
export function hashTranscript(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function answerChangedSinceWriting(story: Story): boolean {
  if (!story.writtenFromHash) return false;
  return hashTranscript(story.transcript) !== story.writtenFromHash;
}

export function deriveRiverState(story: Story): RiverStoryState {
  const changed = answerChangedSinceWriting(story);

  let id: RiverStoryStateId;
  let label: string;
  let primaryAction: string;

  if (story.status === "published") {
    id = "published";
    label = "Published";
    primaryAction = "View story";
  } else if (!story.article.trim()) {
    id = "answer_saved";
    label = "Answer saved. Not written yet.";
    primaryAction = "Write my story";
  } else if (story.safety?.verdict === "block") {
    id = "blocked";
    label = "Can't be published as written";
    primaryAction = "Edit story";
  } else if (story.checkedAt === null || changed) {
    id = "needs_check";
    label = "Needs checking";
    primaryAction = "Check again";
  } else if (
    (story.review && story.review.verdict !== "pass") ||
    (story.safety && story.safety.verdict !== "allow")
  ) {
    id = "needs_changes";
    label = "Needs changes";
    primaryAction = "Edit story";
  } else if (story.status === "reviewed") {
    id = "ready";
    label = "Ready to publish";
    primaryAction = "Review and publish";
  } else {
    id = "needs_check";
    label = "Needs checking";
    primaryAction = "Check again";
  }

  return { id, label, primaryAction, answerChangedSinceWriting: changed };
}

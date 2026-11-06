import { getStory } from "./store";
import type { Story } from "./types";

/**
 * Strict ownership for River stories (plan/river-experience.md §7.1).
 * Legacy content with `authorId: null` belongs to nobody and can never be
 * edited, deleted, or published by a River.
 */

/** Returns the story only when it exists AND belongs to `userId`. */
export async function getOwnedStory(storyId: string, userId: string): Promise<Story | null> {
  const story = await getStory(storyId);
  if (!story) return null;
  if (!story.authorId || story.authorId !== userId) return null;
  return story;
}

export type OwnedStoryResult = { story: Story } | { response: Response };

/** API-route guard: returns the owned story or a 404/403 Response. */
export async function requireOwnedStory(
  storyId: string,
  userId: string,
): Promise<OwnedStoryResult> {
  const story = await getStory(storyId);
  if (!story) {
    return { response: Response.json({ error: "Unknown story" }, { status: 404 }) };
  }
  if (!story.authorId || story.authorId !== userId) {
    return {
      response: Response.json(
        { error: "This story belongs to another River." },
        { status: 403 },
      ),
    };
  }
  return { story };
}

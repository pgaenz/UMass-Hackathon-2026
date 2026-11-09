import { promises as fs } from "node:fs";
import path from "node:path";

import { removeConversationsForStory } from "./conversations";
import { removeLikesForStory } from "./likes";
import { unlinkStoryFromQuestion } from "./questions";
import { deleteStory, getStory } from "./store";

/**
 * Permanent delete cascade (plan/river-experience.md §7.3, D4/D7).
 * Order matters: the record is removed first so public pages stop showing it,
 * then references are cleaned up, then files are deleted.
 */

const UPLOAD_ROOT = path.resolve(process.cwd(), "data", "uploads");

/** True only for paths that resolve inside data/uploads/ (path-traversal guard). */
export function isInsideUploads(relativePath: string): boolean {
  const resolved = path.resolve(process.cwd(), relativePath);
  return resolved === UPLOAD_ROOT || resolved.startsWith(`${UPLOAD_ROOT}${path.sep}`);
}

async function deleteUploadFile(relativePath: string | null | undefined): Promise<void> {
  if (!relativePath) return;
  // Only ever delete inside data/uploads/, guarding against path traversal.
  if (!isInsideUploads(relativePath)) {
    console.warn(`[delete-story] refused to delete outside uploads: ${relativePath}`);
    return;
  }
  const resolved = path.resolve(process.cwd(), relativePath);
  try {
    await fs.unlink(resolved);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      // The record is already gone; never fail the request for a file error.
      console.error(`[delete-story] could not delete ${relativePath}:`, err);
    }
  }
}

export async function deleteStoryCascade(storyId: string): Promise<boolean> {
  const story = await getStory(storyId);
  if (!story) return false;

  // Collect audio paths before the records are removed.
  const conversations = await removeConversationsForStory(storyId);
  const audioPaths = [
    story.rawAudioPath,
    ...story.feedback.map((entry) => entry.rawAudioPath),
    ...conversations.flatMap((conversation) =>
      conversation.turns.map((turn) => turn.user?.audioPath ?? null),
    ),
  ];

  // 1. Remove the story record.
  await deleteStory(storyId);
  // 2. Likes. 3. Question links. 4. (Conversations already removed above.)
  await removeLikesForStory(storyId);
  await unlinkStoryFromQuestion(storyId);
  // 5. Files inside data/uploads/ only.
  await Promise.all(audioPaths.map((audioPath) => deleteUploadFile(audioPath)));
  // 6. Reports are intentionally left in place (they reference the target by id).
  return true;
}

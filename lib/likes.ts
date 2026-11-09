import { iso } from "./db-mappers";
import { prisma } from "./db";
import { isBlocked } from "./chat";
import { getTopics } from "./questions";
import type { LikeMatch, StoryLikeState, User } from "./types";
import { getUser, listUsers, toPublicUser } from "./users";

export async function countLikes(storyId: string): Promise<number> {
  return prisma.storyLike.count({ where: { storyId } });
}

export async function isLiked(storyId: string, userId: string): Promise<boolean> {
  const row = await prisma.storyLike.findUnique({
    where: { storyId_userId: { storyId, userId } },
    select: { storyId: true },
  });
  return row !== null;
}

export async function likerIds(storyId: string): Promise<string[]> {
  const rows = await prisma.storyLike.findMany({
    where: { storyId },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

/**
 * Batch state for a page of stories in one read, so the feed never does N+1
 * lookups. `viewerId` is null for visitors (counts only, never "liked").
 */
export async function getLikeStates(
  storyIds: string[],
  viewerId: string | null,
): Promise<Record<string, StoryLikeState>> {
  const states: Record<string, StoryLikeState> = {};
  for (const id of storyIds) {
    states[id] = { liked: false, count: 0 };
  }
  if (storyIds.length === 0) return states;

  const rows = await prisma.storyLike.findMany({
    where: { storyId: { in: storyIds } },
    select: { storyId: true, userId: true },
  });
  for (const row of rows) {
    const state = states[row.storyId];
    if (!state) continue;
    state.count += 1;
    if (viewerId && row.userId === viewerId) {
      state.liked = true;
    }
  }
  return states;
}

/**
 * Idempotent set: like if absent, remove if present. Unique on (storyId, userId)
 * so the count can never be inflated by double clicks. Returns the new count.
 */
export async function setLike(
  storyId: string,
  userId: string,
  liked: boolean,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    if (liked) {
      // `createMany` uses INSERT ... ON CONFLICT DO NOTHING, so concurrent
      // requests cannot race into a duplicate-key error.
      await tx.storyLike.createMany({
        data: [{ storyId, userId }],
        skipDuplicates: true,
      });
    } else {
      await tx.storyLike.deleteMany({ where: { storyId, userId } });
    }
    return tx.storyLike.count({ where: { storyId } });
  });
}

/** Removes every like for a story (used by the delete cascade). */
export async function removeLikesForStory(storyId: string): Promise<number> {
  const result = await prisma.storyLike.deleteMany({ where: { storyId } });
  return result.count;
}

/**
 * The other liker to surface after a like (see plan/LIKES.md §5).
 *
 * Candidates are other users who liked the same story, minus the viewer and
 * anyone blocked in either direction. They are ranked by shared profile
 * interests (desc) and then most recent like (desc). When nobody shares an
 * interest, the most recent other liker is still returned with an empty
 * `sharedInterests` list, so profiles without interests are never a dead end.
 *
 * Returns null only when there is no eligible other liker.
 */
export async function findLikeMatch(
  storyId: string,
  viewerId: string,
): Promise<LikeMatch | null> {
  const storyLikes = await prisma.storyLike.findMany({
    where: { storyId, userId: { not: viewerId } },
  });
  if (storyLikes.length === 0) return null;

  const [viewer, users, topics] = await Promise.all([
    getUser(viewerId),
    listUsers(),
    getTopics(),
  ]);
  const viewerInterests = new Set(viewer?.interests ?? []);
  const topicLabel = new Map(topics.map((topic) => [topic.id, topic.label]));
  const byId = new Map(users.map((user) => [user.id, user]));

  const seen = new Set<string>();
  const candidates: { user: User; likedAt: string; shared: string[] }[] = [];
  for (const like of storyLikes) {
    if (seen.has(like.userId)) continue;
    seen.add(like.userId);

    const user = byId.get(like.userId);
    if (!user) continue;
    if (await isBlocked(viewerId, user.id)) continue;

    candidates.push({
      user,
      likedAt: iso(like.createdAt),
      shared: user.interests.filter((interest) => viewerInterests.has(interest)),
    });
  }
  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => b.shared.length - a.shared.length || b.likedAt.localeCompare(a.likedAt),
  );
  const best = candidates[0];

  return {
    user: toPublicUser(best.user),
    sharedInterests: best.shared.map((id) => ({ id, label: topicLabel.get(id) ?? id })),
  };
}

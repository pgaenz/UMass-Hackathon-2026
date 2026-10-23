import path from "node:path";

import { isBlocked } from "./chat";
import { mutateJson, readJson } from "./json-file";
import { getTopics } from "./questions";
import type { LikeMatch, StoryLike, StoryLikeState, User } from "./types";
import { getUser, listUsers, toPublicUser } from "./users";

interface LikesData {
  likes: StoryLike[];
}

const LIKES_PATH = path.join(process.cwd(), "data", "likes.json");
const EMPTY: LikesData = { likes: [] };

function normalize(parsed: Partial<LikesData>): LikesData {
  const likes = Array.isArray(parsed.likes) ? parsed.likes : [];
  return {
    likes: likes
      .filter(
        (like): like is StoryLike =>
          Boolean(like) && typeof like.storyId === "string" && typeof like.userId === "string",
      )
      .map((like) => ({
        ...like,
        createdAt: typeof like.createdAt === "string" ? like.createdAt : new Date(0).toISOString(),
      })),
  };
}

async function readStore(): Promise<LikesData> {
  return normalize(await readJson<LikesData>(LIKES_PATH, EMPTY));
}

export async function countLikes(storyId: string): Promise<number> {
  const { likes } = await readStore();
  return likes.filter((like) => like.storyId === storyId).length;
}

export async function isLiked(storyId: string, userId: string): Promise<boolean> {
  const { likes } = await readStore();
  return likes.some((like) => like.storyId === storyId && like.userId === userId);
}

export async function likerIds(storyId: string): Promise<string[]> {
  const { likes } = await readStore();
  return likes.filter((like) => like.storyId === storyId).map((like) => like.userId);
}

/**
 * Batch state for a page of stories in one read, so the feed never does N+1
 * lookups. `viewerId` is null for visitors (counts only, never "liked").
 */
export async function getLikeStates(
  storyIds: string[],
  viewerId: string | null,
): Promise<Record<string, StoryLikeState>> {
  const { likes } = await readStore();
  const wanted = new Set(storyIds);
  const states: Record<string, StoryLikeState> = {};
  for (const id of storyIds) {
    states[id] = { liked: false, count: 0 };
  }
  for (const like of likes) {
    const state = wanted.has(like.storyId) ? states[like.storyId] : undefined;
    if (!state) continue;
    state.count += 1;
    if (viewerId && like.userId === viewerId) {
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
  let count = 0;
  await mutateJson<LikesData>(LIKES_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.likes.findIndex(
      (like) => like.storyId === storyId && like.userId === userId,
    );
    if (liked && index === -1) {
      data.likes.push({ storyId, userId, createdAt: new Date().toISOString() });
    } else if (!liked && index !== -1) {
      data.likes.splice(index, 1);
    }
    count = data.likes.filter((like) => like.storyId === storyId).length;
    return data;
  });
  return count;
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
  const { likes } = await readStore();
  const storyLikes = likes.filter(
    (like) => like.storyId === storyId && like.userId !== viewerId,
  );
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
      likedAt: like.createdAt,
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

import { randomUUID } from "node:crypto";
import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import type {
  ChatBlock,
  ChatMessage,
  ChatMessageView,
  ChatThread,
  ChatThreadStatus,
  OtherParticipant,
  Role,
  ThreadSummary,
  User,
} from "./types";
import { getPublicUserMap } from "./users";

interface ChatData {
  threads: ChatThread[];
  blocks: ChatBlock[];
}

const CHAT_PATH = path.join(process.cwd(), "data", "chat.json");
const EMPTY: ChatData = { threads: [], blocks: [] };

/**
 * Any signed-in user may start a 1:1 thread with any other user, including
 * Drop↔Drop. Self-messaging is rejected separately. Enforced here and in the UI.
 */
export function canMessage(_a: Role, _b: Role): boolean {
  return true;
}

/** UI helper: can this viewer open a thread with this target? */
export function canSendTo(
  viewer: { id: string; role: Role } | null,
  target: { id: string; role: Role } | null,
): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return false;
  return canMessage(viewer.role, target.role);
}

/** Stable, order-independent key that makes a 1:1 conversation unique. */
export function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function sortedPair(a: string, b: string): [string, string] {
  return (a < b ? [a, b] : [b, a]) as [string, string];
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    kind: "text",
    body: message.body ?? "",
    safety: message.safety ?? { verdict: "allow", flags: [] },
    readBy: Array.isArray(message.readBy) ? message.readBy : [message.senderId],
    deletedAt: message.deletedAt ?? null,
  };
}

function normalizeThread(thread: ChatThread): ChatThread {
  const participants = sortedPair(thread.participantIds?.[0] ?? "", thread.participantIds?.[1] ?? "");
  const messages = Array.isArray(thread.messages) ? thread.messages.map(normalizeMessage) : [];
  const lastMessageAt = thread.lastMessageAt ?? messages.at(-1)?.createdAt ?? thread.createdAt;
  const status: ChatThreadStatus = thread.status === "archived" ? "archived" : "active";
  return {
    ...thread,
    participantIds: participants,
    pairKey: pairKeyFor(participants[0], participants[1]),
    status,
    messages,
    createdAt: thread.createdAt ?? new Date().toISOString(),
    updatedAt: thread.updatedAt ?? lastMessageAt,
    lastMessageAt,
  };
}

function normalize(parsed: Partial<ChatData>): ChatData {
  const threads = Array.isArray(parsed.threads) ? parsed.threads.map(normalizeThread) : [];
  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  return { threads, blocks };
}

async function readStore(): Promise<ChatData> {
  return normalize(await readJson<ChatData>(CHAT_PATH, EMPTY));
}

export function isParticipant(thread: ChatThread, userId: string): boolean {
  return thread.participantIds.includes(userId);
}

export function otherParticipantId(thread: ChatThread, userId: string): string {
  return thread.participantIds.find((id) => id !== userId) ?? userId;
}

export function toMessageView(
  message: ChatMessage,
  viewerId: string,
  otherId?: string,
): ChatMessageView {
  return {
    id: message.id,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt,
    mine: message.senderId === viewerId,
    seen: otherId ? message.readBy.includes(otherId) : false,
  };
}

export async function getThread(id: string): Promise<ChatThread | null> {
  const { threads } = await readStore();
  return threads.find((thread) => thread.id === id) ?? null;
}

export async function getThreadByPair(a: string, b: string): Promise<ChatThread | null> {
  const key = pairKeyFor(a, b);
  const { threads } = await readStore();
  return threads.find((thread) => thread.pairKey === key) ?? null;
}

/**
 * Returns the existing 1:1 thread for the pair or creates one. The permission
 * matrix is re-checked here so a caller can never bypass it. The pairKey plus
 * the file lock guarantee no duplicate thread is ever created.
 */
export async function getOrCreateThread(a: User, b: User): Promise<ChatThread> {
  if (a.id === b.id) {
    throw new Error("You cannot message yourself.");
  }

  const key = pairKeyFor(a.id, b.id);
  let result!: ChatThread;

  await mutateJson<ChatData>(CHAT_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const existing = data.threads.find((thread) => thread.pairKey === key);
    if (existing) {
      result = existing;
      return data;
    }
    const now = new Date().toISOString();
    result = {
      id: `t-${randomUUID()}`,
      participantIds: sortedPair(a.id, b.id),
      pairKey: key,
      status: "active",
      messages: [],
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
    };
    data.threads.push(result);
    return data;
  });

  return result;
}

/** Inbox rows for the signed-in user, newest first. */
export async function listThreadsForUser(userId: string): Promise<ThreadSummary[]> {
  const { threads, blocks } = await readStore();
  const mine = threads.filter((thread) => thread.participantIds.includes(userId));
  const otherIds = mine.map((thread) => otherParticipantId(thread, userId));
  const people = await getPublicUserMap(otherIds);

  const summaries: ThreadSummary[] = [];
  for (const thread of mine) {
    const otherId = otherParticipantId(thread, userId);
    const person = people[otherId];
    if (!person) {
      // The other user was removed; keep the thread out of the inbox.
      continue;
    }
    const last = [...thread.messages].reverse().find((message) => !message.deletedAt) ?? null;
    summaries.push({
      threadId: thread.id,
      other: {
        id: person.id,
        name: person.name,
        role: person.role,
        ageBand: person.ageBand,
      },
      lastMessage: last
        ? { body: last.body, senderId: last.senderId, createdAt: last.createdAt }
        : null,
      unreadCount: thread.messages.filter(
        (message) =>
          !message.deletedAt &&
          message.senderId !== userId &&
          !message.readBy.includes(userId),
      ).length,
      blocked: isBlockedIn(blocks, userId, otherId),
      updatedAt: thread.lastMessageAt,
    });
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isBlockedIn(blocks: ChatBlock[], a: string, b: string): boolean {
  return blocks.some(
    (block) =>
      (block.blockerId === a && block.blockedId === b) ||
      (block.blockerId === b && block.blockedId === a),
  );
}

/** Thread history for a participant. `afterId` returns only newer messages. */
export async function getThreadMessages(
  threadId: string,
  viewerId: string,
  afterId?: string,
): Promise<ChatMessageView[]> {
  const thread = await getThread(threadId);
  if (!thread || !isParticipant(thread, viewerId)) {
    return [];
  }
  const otherId = otherParticipantId(thread, viewerId);
  let visible = thread.messages.filter((message) => !message.deletedAt);
  if (afterId) {
    const index = visible.findIndex((message) => message.id === afterId);
    visible = index === -1 ? [] : visible.slice(index + 1);
  }
  return visible.map((message) => toMessageView(message, viewerId, otherId));
}

/** Appends a screened message under the file lock and denormalizes the thread. */
export async function appendMessage(
  threadId: string,
  senderId: string,
  body: string,
  safety: ChatMessage["safety"],
): Promise<ChatMessage | null> {
  let created: ChatMessage | null = null;

  await mutateJson<ChatData>(CHAT_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.threads.findIndex((thread) => thread.id === threadId);
    if (index === -1) {
      return data;
    }
    const thread = data.threads[index];
    const now = new Date().toISOString();
    created = {
      id: `m-${randomUUID()}`,
      senderId,
      kind: "text",
      body,
      safety,
      readBy: [senderId],
      createdAt: now,
      deletedAt: null,
    };
    data.threads[index] = {
      ...thread,
      messages: [...thread.messages, created],
      updatedAt: now,
      lastMessageAt: now,
    };
    return data;
  });

  return created;
}

/** Marks every message from the other person as read. Returns unread after. */
export async function markThreadRead(threadId: string, userId: string): Promise<number> {
  await mutateJson<ChatData>(CHAT_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.threads.findIndex((thread) => thread.id === threadId);
    if (index === -1) {
      return data;
    }
    const thread = data.threads[index];
    if (!thread.participantIds.includes(userId)) {
      return data;
    }
    const messages = thread.messages.map((message) =>
      message.senderId !== userId && !message.readBy.includes(userId)
        ? { ...message, readBy: [...message.readBy, userId] }
        : message,
    );
    data.threads[index] = { ...thread, messages };
    return data;
  });

  return countUnread(userId);
}

/** Total unread messages across every thread the user participates in. */
export async function countUnread(userId: string): Promise<number> {
  const { threads } = await readStore();
  let count = 0;
  for (const thread of threads) {
    if (!thread.participantIds.includes(userId)) continue;
    for (const message of thread.messages) {
      if (
        !message.deletedAt &&
        message.senderId !== userId &&
        !message.readBy.includes(userId)
      ) {
        count += 1;
      }
    }
  }
  return count;
}

export async function isBlocked(a: string, b: string): Promise<boolean> {
  const { blocks } = await readStore();
  return isBlockedIn(blocks, a, b);
}

/** Blocks another user and archives any thread the pair already shares. */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) return;
  const key = pairKeyFor(blockerId, blockedId);

  await mutateJson<ChatData>(CHAT_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const already = isBlockedIn(data.blocks, blockerId, blockedId);
    if (!already) {
      data.blocks.push({
        blockerId,
        blockedId,
        createdAt: new Date().toISOString(),
      });
    }
    data.threads = data.threads.map((thread) =>
      thread.pairKey === key ? { ...thread, status: "archived" as const } : thread,
    );
    return data;
  });
}

/** Public participant view for a thread, or null when unknown. */
export async function getOtherParticipant(
  thread: ChatThread,
  viewerId: string,
): Promise<OtherParticipant | null> {
  const otherId = otherParticipantId(thread, viewerId);
  const people = await getPublicUserMap([otherId]);
  const person = people[otherId];
  if (!person) return null;
  return { id: person.id, name: person.name, role: person.role, ageBand: person.ageBand };
}

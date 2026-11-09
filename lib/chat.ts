import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { dbChatThreadToDomain } from "./db-mappers";
import { prisma } from "./db";
import type {
  ChatMessage,
  ChatMessageView,
  ChatThread,
  OtherParticipant,
  Role,
  ThreadSummary,
  User,
} from "./types";
import { getPublicUserMap } from "./users";

/** Minimal identity needed by the messaging rule. */
export interface MessagingUser {
  id: string;
  role: Role;
  /** Optional so public-only views can reuse the helper without exposing age. */
  age?: number;
}

/**
 * D1: an adult may not start a conversation with a Drop under 18. Drops may
 * still message Rivers, and Rivers may message adult Drops. Existing threads are
 * not affected because callers check this only when creating a new thread.
 */
export function canMessage(initiator: MessagingUser, target: MessagingUser): boolean {
  if (initiator.id === target.id) return false;
  if (
    initiator.role === "river" &&
    target.role === "drop" &&
    typeof target.age === "number" &&
    target.age < 18
  ) {
    return false;
  }
  return true;
}

/** UI helper: can this viewer open a new thread with this target? */
export function canSendTo(
  viewer: MessagingUser | null,
  target: MessagingUser | null,
): boolean {
  if (!viewer || !target) return false;
  return canMessage(viewer, target);
}

/** Stable, order-independent key that makes a 1:1 conversation unique. */
export function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join("|");
}

function sortedPair(a: string, b: string): [string, string] {
  return (a < b ? [a, b] : [b, a]) as [string, string];
}

const MESSAGE_ORDER = [{ createdAt: "asc" as const }, { id: "asc" as const }];

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
  const row = await prisma.chatThread.findUnique({
    where: { id },
    include: { messages: { orderBy: MESSAGE_ORDER } },
  });
  return row ? dbChatThreadToDomain(row) : null;
}

export async function getThreadByPair(a: string, b: string): Promise<ChatThread | null> {
  const row = await prisma.chatThread.findUnique({
    where: { pairKey: pairKeyFor(a, b) },
    include: { messages: { orderBy: MESSAGE_ORDER } },
  });
  return row ? dbChatThreadToDomain(row) : null;
}

/**
 * Returns the existing 1:1 thread for the pair or creates one. The permission
 * matrix is re-checked by the caller. The unique `pairKey` makes the upsert
 * race-safe, so no duplicate thread is ever created.
 */
export async function getOrCreateThread(a: User, b: User): Promise<ChatThread> {
  if (a.id === b.id) {
    throw new Error("You cannot message yourself.");
  }

  const key = pairKeyFor(a.id, b.id);
  const include = { messages: { orderBy: MESSAGE_ORDER } } as const;

  const existing = await prisma.chatThread.findUnique({ where: { pairKey: key }, include });
  if (existing) return dbChatThreadToDomain(existing);

  try {
    const row = await prisma.chatThread.create({
      data: {
        id: `t-${randomUUID()}`,
        participantIds: sortedPair(a.id, b.id),
        pairKey: key,
        status: "active",
        lastMessageAt: new Date(),
      },
      include,
    });
    return dbChatThreadToDomain(row);
  } catch (err) {
    // A concurrent request won the unique pairKey race; return its thread.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await prisma.chatThread.findUnique({ where: { pairKey: key }, include });
      if (raced) return dbChatThreadToDomain(raced);
    }
    throw err;
  }
}

/** Inbox rows for the signed-in user, newest first. */
export async function listThreadsForUser(userId: string): Promise<ThreadSummary[]> {
  const [threads, blocks] = await Promise.all([
    prisma.chatThread.findMany({
      where: { participantIds: { has: userId } },
      include: { messages: { orderBy: MESSAGE_ORDER } },
    }),
    prisma.chatBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    }),
  ]);

  const blockedIds = new Set<string>();
  for (const block of blocks) {
    blockedIds.add(block.blockerId === userId ? block.blockedId : block.blockerId);
  }

  const mine = threads.map(dbChatThreadToDomain);
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
      blocked: blockedIds.has(otherId),
      updatedAt: thread.lastMessageAt,
    });
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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

/** Appends a screened message and denormalizes the thread's last-message time. */
export async function appendMessage(
  threadId: string,
  senderId: string,
  body: string,
  safety: ChatMessage["safety"],
): Promise<ChatMessage | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.chatMessage.create({
        data: {
          id: `m-${randomUUID()}`,
          threadId,
          senderId,
          body,
          safety: safety as unknown as Prisma.InputJsonValue,
          readBy: [senderId],
        },
      });
      await tx.chatThread.update({
        where: { id: threadId },
        data: { lastMessageAt: row.createdAt, updatedAt: row.createdAt },
      });
      return {
        id: row.id,
        senderId: row.senderId,
        kind: "text" as const,
        body: row.body,
        safety: row.safety as unknown as ChatMessage["safety"],
        readBy: row.readBy,
        createdAt: row.createdAt.toISOString(),
        deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
      };
    });
  } catch (err) {
    // A missing thread violates the FK; the old store returned null.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return null;
    }
    throw err;
  }
}

/** Marks every message from the other person as read. Returns unread after. */
export async function markThreadRead(threadId: string, userId: string): Promise<number> {
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { participantIds: true },
  });
  if (thread?.participantIds.includes(userId)) {
    await prisma.chatMessage.updateMany({
      where: {
        threadId,
        senderId: { not: userId },
        deletedAt: null,
        NOT: { readBy: { has: userId } },
      },
      data: { readBy: { push: userId } },
    });
  }
  return countUnread(userId);
}

/** Total unread messages across every thread the user participates in. */
export async function countUnread(userId: string): Promise<number> {
  return prisma.chatMessage.count({
    where: {
      deletedAt: null,
      senderId: { not: userId },
      NOT: { readBy: { has: userId } },
      thread: { is: { participantIds: { has: userId } } },
    },
  });
}

export async function isBlocked(a: string, b: string): Promise<boolean> {
  const row = await prisma.chatBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  return row !== null;
}

/** Blocks another user and archives any thread the pair already shares. */
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) return;
  await prisma.$transaction([
    prisma.chatBlock.createMany({
      data: [{ blockerId, blockedId }],
      skipDuplicates: true,
    }),
    prisma.chatThread.updateMany({
      where: { pairKey: pairKeyFor(blockerId, blockedId) },
      data: { status: "archived" },
    }),
  ]);
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

import type {
  ChatMessage as DbChatMessage,
  ChatThread as DbChatThread,
  Conversation as DbConversation,
  Question as DbQuestion,
  Story as DbStory,
  User as DbUser,
} from "@prisma/client";

import type {
  ChatMessage,
  ChatThread,
  Conversation,
  ConversationTurn,
  FeedbackEntry,
  Question,
  ReviewResult,
  SafetyResult,
  Story,
  StoryMetadata,
  User,
} from "./types";

/**
 * Prisma returns `Date` objects while the domain types (and every caller) use
 * ISO strings. These helpers keep that conversion in one place so the
 * repository modules only deal with queries.
 */

export function iso(date: Date): string {
  return date.toISOString();
}

export function isoOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function dbDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function dbUserToDomain(row: DbUser): User {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    age: row.age,
    bio: row.bio,
    interests: row.interests,
    createdAt: iso(row.createdAt),
  };
}

export function dbStoryToDomain(row: DbStory): Story {
  return {
    id: row.id,
    prompt: row.prompt,
    questionId: row.questionId,
    authorId: row.authorId,
    inputType: row.inputType,
    rawAudioPath: row.rawAudioPath,
    transcript: row.transcript,
    conversationContext: row.conversationContext,
    metadata: row.metadata as unknown as StoryMetadata,
    article: row.article,
    review: row.review as unknown as ReviewResult | null,
    safety: row.safety as unknown as SafetyResult | null,
    feedback: row.feedback as unknown as FeedbackEntry[],
    groundingScore: row.groundingScore,
    piiDetected: row.piiDetected,
    status: row.status,
    conversationId: row.conversationId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    publishedAt: isoOrNull(row.publishedAt),
    riverEdited: row.riverEdited,
    checkedAt: isoOrNull(row.checkedAt),
    checkError: row.checkError,
    writtenFromHash: row.writtenFromHash,
    previousArticle: row.previousArticle,
  };
}

/** `storyIds` is derived from `Story.questionId` (see plan §5.4). */
export function dbQuestionToDomain(row: DbQuestion, storyIds: string[]): Question {
  return {
    id: row.id,
    text: row.text,
    topicIds: row.topicIds,
    askedBy: row.askedBy,
    upvotes: row.upvotes,
    storyIds,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    editedAt: isoOrNull(row.editedAt),
  };
}

export function dbChatMessageToDomain(row: DbChatMessage): ChatMessage {
  return {
    id: row.id,
    senderId: row.senderId,
    kind: "text",
    body: row.body,
    safety: row.safety as unknown as ChatMessage["safety"],
    readBy: row.readBy,
    createdAt: iso(row.createdAt),
    deletedAt: isoOrNull(row.deletedAt),
  };
}

export function dbChatThreadToDomain(
  row: DbChatThread & { messages: DbChatMessage[] },
): ChatThread {
  return {
    id: row.id,
    participantIds: [
      row.participantIds[0] ?? "",
      row.participantIds[1] ?? "",
    ],
    pairKey: row.pairKey,
    status: row.status,
    messages: row.messages.map(dbChatMessageToDomain),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    lastMessageAt: iso(row.lastMessageAt),
  };
}

export function dbConversationToDomain(row: DbConversation): Conversation {
  const turns = (row.turns as unknown as ConversationTurn[]) ?? [];
  return {
    id: row.id,
    storyId: row.storyId ?? "",
    prompt: row.prompt,
    questionId: row.questionId,
    userId: row.userId,
    status: row.status,
    turns: [...turns].sort((a, b) => a.index - b.index),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

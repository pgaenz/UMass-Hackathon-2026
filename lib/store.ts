import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { dbDate, dbStoryToDomain } from "./db-mappers";
import { prisma } from "./db";
import type { FeedbackEntry, Story, StoryStatus } from "./types";

/** `null`/`undefined` become a SQL NULL; anything else is stored as JSON. */
function jsonOrDbNull(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}

export async function getAllStories(): Promise<Story[]> {
  const rows = await prisma.story.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map(dbStoryToDomain);
}

export async function getStory(id: string): Promise<Story | null> {
  const row = await prisma.story.findUnique({ where: { id } });
  return row ? dbStoryToDomain(row) : null;
}

export async function getStoriesByStatus(status: StoryStatus): Promise<Story[]> {
  const rows = await prisma.story.findMany({ where: { status } });
  return rows.map(dbStoryToDomain);
}

export async function getStoriesByAuthor(authorId: string): Promise<Story[]> {
  const rows = await prisma.story.findMany({ where: { authorId } });
  return rows.map(dbStoryToDomain);
}

export async function createStory(input: Partial<Story> = {}): Promise<Story> {
  const now = new Date();
  const createdAt = dbDate(input.createdAt) ?? now;

  const row = await prisma.story.create({
    data: {
      id: input.id ?? randomUUID(),
      prompt: input.prompt ?? "",
      questionId: input.questionId ?? null,
      authorId: input.authorId ?? null,
      inputType: input.inputType ?? "text",
      rawAudioPath: input.rawAudioPath ?? null,
      transcript: input.transcript ?? "",
      conversationContext: input.conversationContext ?? null,
      metadata: (input.metadata ?? { topic: "", summary: "" }) as unknown as Prisma.InputJsonValue,
      article: input.article ?? "",
      review: jsonOrDbNull(input.review),
      safety: jsonOrDbNull(input.safety),
      feedback: (input.feedback ?? []) as unknown as Prisma.InputJsonValue,
      groundingScore: input.groundingScore ?? 0,
      piiDetected: input.piiDetected ?? false,
      status: input.status ?? "draft",
      conversationId: input.conversationId ?? null,
      createdAt,
      updatedAt: dbDate(input.updatedAt) ?? createdAt,
      publishedAt: dbDate(input.publishedAt),
      riverEdited: input.riverEdited ?? false,
      checkedAt: dbDate(input.checkedAt),
      checkError: input.checkError ?? null,
      writtenFromHash: input.writtenFromHash ?? null,
      previousArticle: input.previousArticle ?? null,
    },
  });
  return dbStoryToDomain(row);
}

export async function updateStory(id: string, patch: Partial<Story>): Promise<Story | null> {
  const data: Prisma.StoryUncheckedUpdateInput = {};

  if (patch.prompt !== undefined) data.prompt = patch.prompt;
  if (patch.questionId !== undefined) data.questionId = patch.questionId;
  if (patch.authorId !== undefined) data.authorId = patch.authorId;
  if (patch.inputType !== undefined) data.inputType = patch.inputType;
  if (patch.rawAudioPath !== undefined) data.rawAudioPath = patch.rawAudioPath;
  if (patch.transcript !== undefined) data.transcript = patch.transcript;
  if (patch.conversationContext !== undefined) {
    data.conversationContext = patch.conversationContext;
  }
  if (patch.metadata !== undefined) {
    data.metadata = patch.metadata as unknown as Prisma.InputJsonValue;
  }
  if (patch.article !== undefined) data.article = patch.article;
  if (patch.review !== undefined) data.review = jsonOrDbNull(patch.review);
  if (patch.safety !== undefined) data.safety = jsonOrDbNull(patch.safety);
  if (patch.feedback !== undefined) {
    data.feedback = patch.feedback as unknown as Prisma.InputJsonValue;
  }
  if (patch.groundingScore !== undefined) data.groundingScore = patch.groundingScore;
  if (patch.piiDetected !== undefined) data.piiDetected = patch.piiDetected;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.conversationId !== undefined) data.conversationId = patch.conversationId;
  if (patch.createdAt !== undefined) data.createdAt = dbDate(patch.createdAt) ?? new Date();
  if (patch.updatedAt !== undefined) data.updatedAt = dbDate(patch.updatedAt) ?? new Date();
  if (patch.publishedAt !== undefined) data.publishedAt = dbDate(patch.publishedAt);
  if (patch.riverEdited !== undefined) data.riverEdited = patch.riverEdited;
  if (patch.checkedAt !== undefined) data.checkedAt = dbDate(patch.checkedAt);
  if (patch.checkError !== undefined) data.checkError = patch.checkError;
  if (patch.writtenFromHash !== undefined) data.writtenFromHash = patch.writtenFromHash;
  if (patch.previousArticle !== undefined) data.previousArticle = patch.previousArticle;

  try {
    const row = await prisma.story.update({ where: { id }, data });
    return dbStoryToDomain(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
}

export async function deleteStory(id: string): Promise<boolean> {
  try {
    await prisma.story.delete({ where: { id } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return false;
    }
    throw err;
  }
}

/**
 * Appends one feedback entry with a single atomic JSON update, so concurrent
 * writes can never clobber each other (the file lock used to provide this).
 */
export async function appendFeedback(
  id: string,
  entry: FeedbackEntry,
): Promise<Story | null> {
  const affected = await prisma.$executeRaw`
    UPDATE "Story"
    SET feedback = COALESCE(feedback, '[]'::jsonb) || ${JSON.stringify([entry])}::jsonb
    WHERE id = ${id}
  `;
  if (affected === 0) return null;
  return getStory(id);
}

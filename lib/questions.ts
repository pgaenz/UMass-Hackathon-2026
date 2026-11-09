import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { dbDate, dbQuestionToDomain } from "./db-mappers";
import { prisma } from "./db";
import type { Question, Topic } from "./types";

const STORY_IDS_INCLUDE = { stories: { select: { id: true } } } as const;

function storyIdsOf(row: { stories: { id: string }[] }): string[] {
  return row.stories.map((story) => story.id);
}

export async function getTopics(): Promise<Topic[]> {
  // No ORDER BY: insertion order (the source JSON order) is the display order.
  return prisma.topic.findMany();
}

export async function getQuestions(topicId?: string): Promise<Question[]> {
  const rows = await prisma.question.findMany({
    where: topicId ? { topicIds: { has: topicId } } : undefined,
    orderBy: { upvotes: "desc" },
    include: STORY_IDS_INCLUDE,
  });
  return rows.map((row) => dbQuestionToDomain(row, storyIdsOf(row)));
}

export async function getQuestion(id: string): Promise<Question | null> {
  const row = await prisma.question.findUnique({
    where: { id },
    include: STORY_IDS_INCLUDE,
  });
  return row ? dbQuestionToDomain(row, storyIdsOf(row)) : null;
}

/** Batch lookup for cards/lists — one read, no N+1. Missing ids are omitted. */
export async function getQuestionMap(
  ids: Array<string | null | undefined>,
): Promise<Record<string, Question>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return {};

  const rows = await prisma.question.findMany({
    where: { id: { in: wanted } },
    include: STORY_IDS_INCLUDE,
  });
  const map: Record<string, Question> = {};
  for (const row of rows) {
    map[row.id] = dbQuestionToDomain(row, storyIdsOf(row));
  }
  return map;
}

export async function getQuestionsByUser(userId: string): Promise<Question[]> {
  const rows = await prisma.question.findMany({
    where: { askedBy: userId },
    orderBy: { createdAt: "desc" },
    include: STORY_IDS_INCLUDE,
  });
  return rows.map((row) => dbQuestionToDomain(row, storyIdsOf(row)));
}

export async function createQuestion(input: {
  text: string;
  topicIds?: string[];
  askedBy?: string | null;
}): Promise<Question> {
  const row = await prisma.question.create({
    data: {
      id: `q-${randomUUID()}`,
      text: input.text,
      topicIds: input.topicIds ?? [],
      askedBy: input.askedBy ?? null,
      upvotes: 0,
    },
  });
  return dbQuestionToDomain(row, []);
}

/**
 * Applies a vote delta to a question's denormalized `upvotes` count and returns
 * the new count (or null for an unknown question). The increment is a single
 * atomic SQL statement and clamps at zero, so concurrent votes cannot drift it.
 */
export async function adjustUpvotes(id: string, delta: number): Promise<number | null> {
  const rows = await prisma.$queryRaw<{ upvotes: number }[]>`
    UPDATE "Question"
    SET upvotes = GREATEST(0, upvotes + ${delta}::int)
    WHERE id = ${id}
    RETURNING upvotes
  `;
  return rows[0]?.upvotes ?? null;
}

/** Updates an owned question's text and/or topics (D3). */
export async function updateQuestion(
  id: string,
  patch: { text?: string; topicIds?: string[]; editedAt?: string | null },
): Promise<Question | null> {
  const data: Prisma.QuestionUncheckedUpdateInput = { updatedAt: new Date() };
  if (patch.text !== undefined) data.text = patch.text;
  if (patch.topicIds !== undefined) data.topicIds = patch.topicIds;
  if (patch.editedAt !== undefined) data.editedAt = dbDate(patch.editedAt);

  try {
    const row = await prisma.question.update({
      where: { id },
      data,
      include: STORY_IDS_INCLUDE,
    });
    return dbQuestionToDomain(row, storyIdsOf(row));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
}

/** Permanently removes a question and its per-user votes (D4). */
export async function deleteQuestion(id: string): Promise<boolean> {
  try {
    // QuestionVote rows cascade; linked stories keep existing with questionId null.
    await prisma.question.delete({ where: { id } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return false;
    }
    throw err;
  }
}

/**
 * Clears the story's question link. `Question.storyIds` is derived from
 * `Story.questionId`, so this is a single-row update.
 */
export async function unlinkStoryFromQuestion(storyId: string): Promise<number> {
  const result = await prisma.story.updateMany({
    where: { id: storyId, questionId: { not: null } },
    data: { questionId: null },
  });
  return result.count;
}

/**
 * Links a story to a question by setting the single source of truth
 * (`Story.questionId`) and returns the question with its derived `storyIds`.
 */
export async function linkStoryToQuestion(
  questionId: string,
  storyId: string,
): Promise<Question | null> {
  try {
    await prisma.story.update({ where: { id: storyId }, data: { questionId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
  return getQuestion(questionId);
}

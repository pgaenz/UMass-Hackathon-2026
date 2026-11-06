import { randomUUID } from "node:crypto";
import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import { removeVotesForQuestion } from "./question-votes";
import type { Question, Topic } from "./types";

interface QuestionsData {
  topics: Topic[];
  questions: Question[];
}

const QUESTIONS_PATH = path.join(process.cwd(), "data", "questions.json");
const EMPTY: QuestionsData = { topics: [], questions: [] };

function normalizeQuestion(question: Question): Question {
  const createdAt = question.createdAt ?? new Date(0).toISOString();
  return {
    ...question,
    topicIds: Array.isArray(question.topicIds) ? question.topicIds : [],
    storyIds: Array.isArray(question.storyIds) ? question.storyIds : [],
    upvotes: typeof question.upvotes === "number" ? question.upvotes : 0,
    createdAt,
    updatedAt: question.updatedAt ?? createdAt,
    editedAt: question.editedAt ?? null,
  };
}

function normalize(parsed: Partial<QuestionsData>): QuestionsData {
  return {
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.map(normalizeQuestion)
      : [],
  };
}

async function readStore(): Promise<QuestionsData> {
  return normalize(await readJson<QuestionsData>(QUESTIONS_PATH, EMPTY));
}

export async function getTopics(): Promise<Topic[]> {
  const { topics } = await readStore();
  return topics;
}

export async function getQuestions(topicId?: string): Promise<Question[]> {
  const { questions } = await readStore();
  const filtered = topicId
    ? questions.filter((question) => question.topicIds.includes(topicId))
    : questions;
  return [...filtered].sort((a, b) => b.upvotes - a.upvotes);
}

export async function getQuestion(id: string): Promise<Question | null> {
  const { questions } = await readStore();
  return questions.find((question) => question.id === id) ?? null;
}

/** Batch lookup for cards/lists — one read, no N+1. Missing ids are omitted. */
export async function getQuestionMap(
  ids: Array<string | null | undefined>,
): Promise<Record<string, Question>> {
  const wanted = new Set(ids.filter((id): id is string => Boolean(id)));
  if (wanted.size === 0) return {};
  const { questions } = await readStore();
  const map: Record<string, Question> = {};
  for (const question of questions) {
    if (wanted.has(question.id)) map[question.id] = question;
  }
  return map;
}

export async function getQuestionsByUser(userId: string): Promise<Question[]> {
  const { questions } = await readStore();
  return questions
    .filter((question) => question.askedBy === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createQuestion(input: {
  text: string;
  topicIds?: string[];
  askedBy?: string | null;
}): Promise<Question> {
  let created!: Question;
  await mutateJson<QuestionsData>(QUESTIONS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const now = new Date().toISOString();
    created = {
      id: `q-${randomUUID()}`,
      text: input.text,
      topicIds: input.topicIds ?? [],
      askedBy: input.askedBy ?? null,
      upvotes: 0,
      storyIds: [],
      createdAt: now,
      updatedAt: now,
      editedAt: null,
    };
    data.questions.push(created);
    return data;
  });
  return created;
}

/**
 * Applies a vote delta to a question's denormalized `upvotes` count and returns
 * the new count (or null for an unknown question). The per-user truth lives in
 * `data/question-votes.json`; this keeps sorting and the existing UI on the
 * stored number (plan/UX-FIXES-2.md §6, D8).
 */
export async function adjustUpvotes(id: string, delta: number): Promise<number | null> {
  let count: number | null = null;
  await mutateJson<QuestionsData>(QUESTIONS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.questions.findIndex((question) => question.id === id);
    if (index !== -1) {
      const next = Math.max(0, data.questions[index].upvotes + delta);
      data.questions[index] = { ...data.questions[index], upvotes: next };
      count = next;
    }
    return data;
  });
  return count;
}

/** Updates an owned question's text and/or topics (D3). */
export async function updateQuestion(
  id: string,
  patch: { text?: string; topicIds?: string[]; editedAt?: string | null },
): Promise<Question | null> {
  let updated: Question | null = null;
  await mutateJson<QuestionsData>(QUESTIONS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.questions.findIndex((question) => question.id === id);
    if (index !== -1) {
      const now = new Date().toISOString();
      updated = normalizeQuestion({
        ...data.questions[index],
        ...patch,
        updatedAt: now,
      });
      data.questions[index] = updated;
    }
    return data;
  });
  return updated;
}

/** Permanently removes a question and its per-user votes (D4). */
export async function deleteQuestion(id: string): Promise<boolean> {
  let removed = false;
  await mutateJson<QuestionsData>(QUESTIONS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const next = data.questions.filter((question) => question.id !== id);
    removed = next.length !== data.questions.length;
    data.questions = next;
    return data;
  });
  if (removed) await removeVotesForQuestion(id);
  return removed;
}

/** Removes a story id from every question's storyIds (delete cascade). */
export async function unlinkStoryFromQuestion(storyId: string): Promise<number> {
  let removed = 0;
  await mutateJson<QuestionsData>(QUESTIONS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    data.questions = data.questions.map((question) => {
      if (!question.storyIds.includes(storyId)) return question;
      removed += 1;
      return { ...question, storyIds: question.storyIds.filter((id) => id !== storyId) };
    });
    return data;
  });
  return removed;
}

export async function linkStoryToQuestion(
  questionId: string,
  storyId: string,
): Promise<Question | null> {
  let updated: Question | null = null;
  await mutateJson<QuestionsData>(QUESTIONS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.questions.findIndex((question) => question.id === questionId);
    if (index !== -1) {
      const question = data.questions[index];
      updated = question.storyIds.includes(storyId)
        ? question
        : { ...question, storyIds: [...question.storyIds, storyId] };
      data.questions[index] = updated;
    }
    return data;
  });
  return updated;
}

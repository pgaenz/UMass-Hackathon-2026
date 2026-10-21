import { randomUUID } from "node:crypto";
import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import type { Question, Topic } from "./types";

interface QuestionsData {
  topics: Topic[];
  questions: Question[];
}

const QUESTIONS_PATH = path.join(process.cwd(), "data", "questions.json");
const EMPTY: QuestionsData = { topics: [], questions: [] };

function normalize(parsed: Partial<QuestionsData>): QuestionsData {
  return {
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
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
    created = {
      id: `q-${randomUUID()}`,
      text: input.text,
      topicIds: input.topicIds ?? [],
      askedBy: input.askedBy ?? null,
      upvotes: 0,
      storyIds: [],
      createdAt: new Date().toISOString(),
    };
    data.questions.push(created);
    return data;
  });
  return created;
}

export async function upvoteQuestion(id: string): Promise<Question | null> {
  let updated: Question | null = null;
  await mutateJson<QuestionsData>(QUESTIONS_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.questions.findIndex((question) => question.id === id);
    if (index !== -1) {
      updated = { ...data.questions[index], upvotes: data.questions[index].upvotes + 1 };
      data.questions[index] = updated;
    }
    return data;
  });
  return updated;
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

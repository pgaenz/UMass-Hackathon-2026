import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { Question, Topic } from "./types";

interface QuestionsData {
  topics: Topic[];
  questions: Question[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const QUESTIONS_PATH = path.join(DATA_DIR, "questions.json");

async function readStore(): Promise<QuestionsData> {
  try {
    const raw = await fs.readFile(QUESTIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as QuestionsData;
    return {
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { topics: [], questions: [] };
    }
    throw err;
  }
}

async function writeStore(data: QuestionsData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(QUESTIONS_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

export async function createQuestion(input: {
  text: string;
  topicIds?: string[];
  askedBy?: string | null;
}): Promise<Question> {
  const data = await readStore();
  const question: Question = {
    id: `q-${randomUUID()}`,
    text: input.text,
    topicIds: input.topicIds ?? [],
    askedBy: input.askedBy ?? null,
    upvotes: 0,
    storyIds: [],
    createdAt: new Date().toISOString(),
  };
  data.questions.push(question);
  await writeStore(data);
  return question;
}

export async function upvoteQuestion(id: string): Promise<Question | null> {
  const data = await readStore();
  const index = data.questions.findIndex((question) => question.id === id);
  if (index === -1) {
    return null;
  }
  const updated: Question = { ...data.questions[index], upvotes: data.questions[index].upvotes + 1 };
  data.questions[index] = updated;
  await writeStore(data);
  return updated;
}

export async function linkStoryToQuestion(
  questionId: string,
  storyId: string,
): Promise<Question | null> {
  const data = await readStore();
  const index = data.questions.findIndex((question) => question.id === questionId);
  if (index === -1) {
    return null;
  }
  const question = data.questions[index];
  if (question.storyIds.includes(storyId)) {
    return question;
  }
  const updated: Question = { ...question, storyIds: [...question.storyIds, storyId] };
  data.questions[index] = updated;
  await writeStore(data);
  return updated;
}

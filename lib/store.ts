import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { Story, StoryStatus } from "./types";

interface StoreData {
  stories: Story[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "stories.json");

async function readStore(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    return Array.isArray(parsed.stories) ? parsed : { stories: [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { stories: [] };
    }
    throw err;
  }
}

async function writeStore(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getAllStories(): Promise<Story[]> {
  const { stories } = await readStore();
  return stories;
}

export async function getStory(id: string): Promise<Story | null> {
  const { stories } = await readStore();
  return stories.find((story) => story.id === id) ?? null;
}

export async function getStoriesByStatus(status: StoryStatus): Promise<Story[]> {
  const { stories } = await readStore();
  return stories.filter((story) => story.status === status);
}

export async function createStory(input: Partial<Story> = {}): Promise<Story> {
  const data = await readStore();
  const story: Story = {
    id: input.id ?? randomUUID(),
    prompt: input.prompt ?? "",
    questionId: input.questionId ?? null,
    inputType: input.inputType ?? "text",
    rawAudioPath: input.rawAudioPath ?? null,
    transcript: input.transcript ?? "",
    metadata: input.metadata ?? { topic: "", summary: "" },
    article: input.article ?? "",
    groundingScore: input.groundingScore ?? 0,
    piiDetected: input.piiDetected ?? false,
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  data.stories.push(story);
  await writeStore(data);
  return story;
}

export async function updateStory(id: string, patch: Partial<Story>): Promise<Story | null> {
  const data = await readStore();
  const index = data.stories.findIndex((story) => story.id === id);
  if (index === -1) {
    return null;
  }
  const updated: Story = { ...data.stories[index], ...patch, id };
  data.stories[index] = updated;
  await writeStore(data);
  return updated;
}

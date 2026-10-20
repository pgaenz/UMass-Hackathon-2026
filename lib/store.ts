import { randomUUID } from "node:crypto";
import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import type { Story, StoryStatus } from "./types";

interface StoreData {
  stories: Story[];
}

const STORE_PATH = path.join(process.cwd(), "data", "stories.json");
const EMPTY: StoreData = { stories: [] };

function normalize(parsed: Partial<StoreData>): StoreData {
  return { stories: Array.isArray(parsed.stories) ? parsed.stories : [] };
}

async function readStore(): Promise<StoreData> {
  return normalize(await readJson<StoreData>(STORE_PATH, EMPTY));
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
  let created!: Story;
  await mutateJson<StoreData>(STORE_PATH, EMPTY, (current) => {
    const data = normalize(current);
    created = {
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
    data.stories.push(created);
    return data;
  });
  return created;
}

export async function updateStory(id: string, patch: Partial<Story>): Promise<Story | null> {
  let updated: Story | null = null;
  await mutateJson<StoreData>(STORE_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.stories.findIndex((story) => story.id === id);
    if (index !== -1) {
      updated = { ...data.stories[index], ...patch, id };
      data.stories[index] = updated;
    }
    return data;
  });
  return updated;
}

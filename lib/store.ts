import { randomUUID } from "node:crypto";
import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import type { FeedbackEntry, Story, StoryStatus } from "./types";

interface StoreData {
  stories: Story[];
}

const STORE_PATH = path.join(process.cwd(), "data", "stories.json");
const EMPTY: StoreData = { stories: [] };

/** Fills fields added after a story was first persisted (no DB migration needed). */
function normalizeStory(story: Story): Story {
  return {
    ...story,
    authorId: story.authorId ?? null,
    metadata: story.metadata ?? { topic: "", summary: "" },
    review: story.review ?? null,
    safety: story.safety ?? null,
    feedback: Array.isArray(story.feedback) ? story.feedback : [],
    conversationId: story.conversationId ?? null,
    conversationContext: story.conversationContext ?? null,
  };
}

function normalize(parsed: Partial<StoreData>): StoreData {
  const stories = Array.isArray(parsed.stories) ? parsed.stories : [];
  return { stories: stories.map(normalizeStory) };
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

export async function getStoriesByAuthor(authorId: string): Promise<Story[]> {
  const { stories } = await readStore();
  return stories.filter((story) => story.authorId === authorId);
}

export async function createStory(input: Partial<Story> = {}): Promise<Story> {
  let created!: Story;
  await mutateJson<StoreData>(STORE_PATH, EMPTY, (current) => {
    const data = normalize(current);
    created = {
      id: input.id ?? randomUUID(),
      prompt: input.prompt ?? "",
      questionId: input.questionId ?? null,
      authorId: input.authorId ?? null,
      inputType: input.inputType ?? "text",
      rawAudioPath: input.rawAudioPath ?? null,
      transcript: input.transcript ?? "",
      conversationContext: input.conversationContext ?? null,
      metadata: input.metadata ?? { topic: "", summary: "" },
      article: input.article ?? "",
      review: input.review ?? null,
      safety: input.safety ?? null,
      feedback: input.feedback ?? [],
      groundingScore: input.groundingScore ?? 0,
      piiDetected: input.piiDetected ?? false,
      status: input.status ?? "draft",
      conversationId: input.conversationId ?? null,
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

/** Appends one feedback entry under the file lock so concurrent writes never clobber. */
export async function appendFeedback(
  id: string,
  entry: FeedbackEntry,
): Promise<Story | null> {
  let updated: Story | null = null;
  await mutateJson<StoreData>(STORE_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.stories.findIndex((story) => story.id === id);
    if (index !== -1) {
      const story = data.stories[index];
      updated = { ...story, feedback: [...story.feedback, entry] };
      data.stories[index] = updated;
    }
    return data;
  });
  return updated;
}

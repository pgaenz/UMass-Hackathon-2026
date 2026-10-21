import { randomUUID } from "node:crypto";
import path from "node:path";

import { mutateJson, readJson } from "./json-file";
import type {
  Conversation,
  ConversationStatus,
  ConversationTurn,
} from "./types";

interface ConversationStoreData {
  conversations: Conversation[];
}

const STORE_PATH = path.join(process.cwd(), "data", "conversations.json");
const EMPTY: ConversationStoreData = { conversations: [] };

function normalizeTurn(turn: ConversationTurn): ConversationTurn {
  return {
    ...turn,
    user: turn.user ?? null,
    assistant: turn.assistant ?? null,
  };
}

function normalizeConversation(conversation: Conversation): Conversation {
  const turns = Array.isArray(conversation.turns) ? conversation.turns : [];
  return {
    ...conversation,
    questionId: conversation.questionId ?? null,
    userId: conversation.userId ?? null,
    status: conversation.status ?? "active",
    turns: turns
      .map(normalizeTurn)
      .sort((a, b) => a.index - b.index)
      .map((turn, index) => ({ ...turn, index })),
  };
}

function normalize(parsed: Partial<ConversationStoreData>): ConversationStoreData {
  const conversations = Array.isArray(parsed.conversations) ? parsed.conversations : [];
  return { conversations: conversations.map(normalizeConversation) };
}

async function readStore(): Promise<ConversationStoreData> {
  return normalize(await readJson<ConversationStoreData>(STORE_PATH, EMPTY));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { conversations } = await readStore();
  return conversations.find((conversation) => conversation.id === id) ?? null;
}

export async function createConversation(input: {
  storyId: string;
  prompt: string;
  questionId?: string | null;
  userId?: string | null;
}): Promise<Conversation> {
  let created!: Conversation;
  await mutateJson<ConversationStoreData>(STORE_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const now = new Date().toISOString();
    created = {
      id: randomUUID(),
      storyId: input.storyId,
      prompt: input.prompt,
      questionId: input.questionId ?? null,
      userId: input.userId ?? null,
      status: "active",
      turns: [],
      createdAt: now,
      updatedAt: now,
    };
    data.conversations.push(created);
    return data;
  });
  return created;
}

export interface AppendTurnInput {
  user?: ConversationTurn["user"];
  assistant?: ConversationTurn["assistant"];
}

/** Appends a completed turn under the file lock and assigns its index. */
export async function appendTurn(
  conversationId: string,
  input: AppendTurnInput,
): Promise<{ conversation: Conversation; turn: ConversationTurn } | null> {
  let result: { conversation: Conversation; turn: ConversationTurn } | null = null;

  await mutateJson<ConversationStoreData>(STORE_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.conversations.findIndex(
      (conversation) => conversation.id === conversationId,
    );
    if (index === -1) {
      return data;
    }

    const conversation = data.conversations[index];
    const turn: ConversationTurn = {
      id: randomUUID(),
      index: conversation.turns.length,
      user: input.user ?? null,
      assistant: input.assistant ?? null,
      createdAt: new Date().toISOString(),
    };
    const updated: Conversation = {
      ...conversation,
      turns: [...conversation.turns, turn],
      updatedAt: new Date().toISOString(),
    };
    data.conversations[index] = updated;
    result = { conversation: updated, turn };
    return data;
  });

  return result;
}

export async function setConversationStatus(
  id: string,
  status: ConversationStatus,
): Promise<Conversation | null> {
  let updated: Conversation | null = null;
  await mutateJson<ConversationStoreData>(STORE_PATH, EMPTY, (current) => {
    const data = normalize(current);
    const index = data.conversations.findIndex((conversation) => conversation.id === id);
    if (index !== -1) {
      updated = {
        ...data.conversations[index],
        status,
        updatedAt: new Date().toISOString(),
      };
      data.conversations[index] = updated;
    }
    return data;
  });
  return updated;
}

/**
 * Only the senior's own words become the story transcript. Interviewer
 * questions are context, not facts, and must never reach the writing agent.
 */
export function compileSeniorTranscript(conversation: Conversation): string {
  return conversation.turns
    .map((turn) => turn.user?.text.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Formats the whole exchange (interviewer questions/acknowledgments and the
 * senior's answers) as a Q&A transcript. The writing agent uses this to keep the
 * article's narrative connected to what each answer was responding to. Facts must
 * still come only from the senior's own words.
 */
export function compileConversationContext(conversation: Conversation): string {
  const blocks: string[] = [];
  for (const turn of conversation.turns) {
    const lines: string[] = [];
    const assistant = turn.assistant?.text.trim();
    if (assistant) {
      lines.push(`INTERVIEWER: ${assistant}`);
    }
    const user = turn.user?.text.trim();
    if (user) {
      lines.push(`SENIOR: ${user}`);
    }
    if (lines.length > 0) {
      blocks.push(lines.join("\n"));
    }
  }
  return blocks.join("\n\n");
}

export function countSeniorTurns(conversation: Conversation): number {
  return conversation.turns.filter((turn) => Boolean(turn.user)).length;
}

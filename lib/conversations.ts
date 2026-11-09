import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { dbConversationToDomain } from "./db-mappers";
import { prisma } from "./db";
import type {
  Conversation,
  ConversationStatus,
  ConversationTurn,
} from "./types";

export async function getConversation(id: string): Promise<Conversation | null> {
  const row = await prisma.conversation.findUnique({ where: { id } });
  return row ? dbConversationToDomain(row) : null;
}

export async function createConversation(input: {
  storyId: string;
  prompt: string;
  questionId?: string | null;
  userId?: string | null;
}): Promise<Conversation> {
  const row = await prisma.conversation.create({
    data: {
      id: randomUUID(),
      storyId: input.storyId,
      prompt: input.prompt,
      questionId: input.questionId ?? null,
      userId: input.userId ?? null,
      status: "active",
      turns: [],
    },
  });
  return dbConversationToDomain(row);
}

/** Removes every conversation for a story and returns the removed records. */
export async function removeConversationsForStory(storyId: string): Promise<Conversation[]> {
  const rows = await prisma.conversation.findMany({ where: { storyId } });
  if (rows.length > 0) {
    await prisma.conversation.deleteMany({ where: { storyId } });
  }
  return rows.map(dbConversationToDomain);
}

export interface AppendTurnInput {
  user?: ConversationTurn["user"];
  assistant?: ConversationTurn["assistant"];
}

/** Appends a completed turn and assigns its index. */
export async function appendTurn(
  conversationId: string,
  input: AppendTurnInput,
): Promise<{ conversation: Conversation; turn: ConversationTurn } | null> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!row) return null;

    const turns = (row.turns as unknown as ConversationTurn[]) ?? [];
    const turn: ConversationTurn = {
      id: randomUUID(),
      index: turns.length,
      user: input.user ?? null,
      assistant: input.assistant ?? null,
      createdAt: new Date().toISOString(),
    };
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: { turns: [...turns, turn] as unknown as Prisma.InputJsonValue },
    });
    return { conversation: dbConversationToDomain(updated), turn };
  });
}

export async function setConversationStatus(
  id: string,
  status: ConversationStatus,
): Promise<Conversation | null> {
  try {
    const row = await prisma.conversation.update({
      where: { id },
      data: { status },
    });
    return dbConversationToDomain(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
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

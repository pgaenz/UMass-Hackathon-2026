import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * System prompts live as plain Markdown under `/prompts` at the repo root, one
 * file per agent, so they can be edited and reviewed without touching code.
 * Files are read once and cached for the life of the server process.
 */
export type PromptName =
  | "writing_agent"
  | "review_agent"
  | "revision_agent"
  | "conversation_agent";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");
const cache = new Map<PromptName, string>();

export async function loadPrompt(name: PromptName): Promise<string> {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const filePath = path.join(PROMPTS_DIR, `${name}.md`);
  const text = await fs.readFile(filePath, "utf8");
  if (!text.trim()) {
    throw new Error(`Prompt file ${name}.md is empty`);
  }

  cache.set(name, text);
  return text;
}

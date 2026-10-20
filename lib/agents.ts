import { chat } from "./openai";
import type { StoryMetadata } from "./types";

const MAX_TRANSCRIPT_CHARS = 6_000;

const SYSTEM_PROMPT = [
  "You label a senior's spoken story.",
  'Reply with ONLY compact JSON: {"topic": string, "summary": string}.',
  "topic is a 1-3 word category such as Career, Family, or Travel.",
  "summary is one neutral sentence drawn only from the transcript.",
  "Never invent details. Use an empty string when unsure.",
].join(" ");

export async function extractMetadata(transcript: string): Promise<StoryMetadata> {
  const raw = await chat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: transcript.slice(0, MAX_TRANSCRIPT_CHARS) },
    ],
    { temperature: 0 },
  );

  const json = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(json) as { topic?: unknown; summary?: unknown };
    return {
      topic: typeof parsed.topic === "string" ? parsed.topic : "",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch {
    return { topic: "", summary: "" };
  }
}

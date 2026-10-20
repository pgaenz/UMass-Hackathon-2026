import { promises as fs } from "node:fs";
import path from "node:path";

import { extractMetadata } from "@/lib/agents";
import { getQuestion, linkStoryToQuestion } from "@/lib/questions";
import { createStory, updateStory } from "@/lib/store";
import { transcribe } from "@/lib/transcribe";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function errorStatus(err: unknown): number {
  return err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500;
}

/**
 * Validates the optional question a story answers. Returns the canonical id, or
 * a 400 Response when the id is provided but unknown, or null when absent.
 */
async function resolveQuestionId(value: unknown): Promise<string | null | Response> {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return null;
  }
  const question = await getQuestion(raw);
  if (!question) {
    return fail(400, "Unknown question");
  }
  return question.id;
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      return await handleAudio(request);
    }
    return await handleText(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intake failed";
    return fail(errorStatus(err), message);
  }
}

async function handleText(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    inputType?: unknown;
    prompt?: unknown;
    text?: unknown;
    questionId?: unknown;
  } | null;

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return fail(400, "Missing text input");
  }

  const questionId = await resolveQuestionId(body?.questionId);
  if (questionId instanceof Response) {
    return questionId;
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  const story = await createStory({ inputType: "text", prompt, questionId, transcript: text });
  if (questionId) {
    await linkStoryToQuestion(questionId, story.id);
  }
  const metadata = await extractMetadata(text);
  const updated = await updateStory(story.id, { metadata });
  return Response.json({ story: updated ?? story }, { status: 201 });
}

async function handleAudio(request: Request): Promise<Response> {
  const formData = await request.formData();
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return fail(400, "Missing audio file");
  }

  const questionId = await resolveQuestionId(formData.get("questionId"));
  if (questionId instanceof Response) {
    return questionId;
  }

  const prompt = formData.get("prompt");
  const filename = audio.name || "recording.webm";

  const story = await createStory({
    inputType: "audio",
    prompt: typeof prompt === "string" ? prompt : "",
    questionId,
  });
  if (questionId) {
    await linkStoryToQuestion(questionId, story.id);
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const storedName = `${story.id}${path.extname(filename) || ".webm"}`;
  const buffer = Buffer.from(await audio.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const transcript = await transcribe(audio, filename);
  const metadata = await extractMetadata(transcript);
  const updated = await updateStory(story.id, {
    transcript,
    metadata,
    rawAudioPath: `data/uploads/${storedName}`,
  });
  return Response.json({ story: updated ?? story }, { status: 201 });
}

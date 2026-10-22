import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { checkSafety, reviewArticle, reviseArticle, writeArticle } from "@/lib/agents";
import { authorize } from "@/lib/session";
import { appendFeedback, getStory, updateStory } from "@/lib/store";
import { transcribe } from "@/lib/transcribe";
import type { FeedbackEntry, Story } from "@/lib/types";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function errorStatus(err: unknown): number {
  return err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500;
}

interface AudioFeedback {
  transcript: string;
  rawAudioPath: string;
}

/**
 * Runs writing (or revision) and then review for one story, and persists the
 * result. The requested feedback may be text and/or a transcribed recording.
 */
async function runPipeline(
  id: string,
  feedbackText: string,
  audio: AudioFeedback | null,
  ownerId: string,
): Promise<Response> {
  const story = await getStory(id);
  if (!story) {
    return fail(404, "Unknown story");
  }
  if (story.authorId && story.authorId !== ownerId) {
    return fail(403, "This story belongs to another River.");
  }
  if (!story.transcript.trim()) {
    return fail(400, "This answer has no transcript to write from");
  }

  const feedbackEntry: FeedbackEntry | null =
    feedbackText || audio
      ? {
          id: randomUUID(),
          source: "user",
          text: feedbackText || audio?.transcript || "",
          rawAudioPath: audio?.rawAudioPath ?? null,
          createdAt: new Date().toISOString(),
        }
      : null;

  const hasArticle = Boolean(story.article.trim());

  const allFeedback = [
    ...story.feedback.map((entry) => entry.text),
    ...(feedbackEntry ? [feedbackEntry.text] : []),
  ].filter(Boolean);

  // First submission → write. Otherwise → revise using every round of feedback.
  let draft = hasArticle
    ? await reviseArticle({
        transcript: story.transcript,
        conversationContext: story.conversationContext,
        article: story.article,
        review: story.review,
        safety: story.safety,
        feedback: allFeedback,
      })
    : await writeArticle(story.transcript, story.conversationContext);

  // Safety runs FIRST: an unsafe article never reaches the grounding review.
  let safety = await checkSafety({
    content: draft.article,
    kind: "article",
    context: story.transcript,
  });

  // Soft safety issues (e.g. mild profanity) get one automatic cleanup pass.
  if (safety.verdict === "revise") {
    const cleaned = await reviseArticle({
      transcript: story.transcript,
      conversationContext: story.conversationContext,
      article: draft.article,
      review: story.review,
      safety,
      feedback: allFeedback,
    });
    draft = cleaned;
    safety = await checkSafety({
      content: cleaned.article,
      kind: "article",
      context: story.transcript,
    });
  }

  const review =
    safety.verdict === "allow"
      ? await reviewArticle({ transcript: story.transcript, article: draft.article })
      : null;

  if (feedbackEntry) {
    await appendFeedback(id, feedbackEntry);
  }

  const updated = await updateStory(id, {
    article: draft.article,
    metadata: draft.metadata,
    review,
    safety,
    groundingScore: review?.score ?? 0,
    status: review?.verdict === "pass" ? "reviewed" : "draft",
  });

  return Response.json(
    { story: updated ?? ({ ...story, ...draft, review, safety } satisfies Story) },
    { status: 200 },
  );
}

async function handleJson(request: Request, ownerId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    feedback?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return fail(400, "Missing story id");
  }
  const feedback = typeof body?.feedback === "string" ? body.feedback.trim() : "";
  return runPipeline(id, feedback, null, ownerId);
}

async function handleMultipart(request: Request, ownerId: string): Promise<Response> {
  const formData = await request.formData();
  const rawId = formData.get("id");
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) {
    return fail(400, "Missing story id");
  }

  const rawFeedback = formData.get("feedback");
  const feedback = typeof rawFeedback === "string" ? rawFeedback.trim() : "";

  const audio = formData.get("feedbackAudio");
  if (audio instanceof File && audio.size > 0) {
    const transcript = await transcribe(audio, audio.name || "feedback.webm");
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const storedName = `feedback-${id}-${Date.now()}${path.extname(audio.name) || ".webm"}`;
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await audio.arrayBuffer()));
    return runPipeline(id, feedback, {
      transcript,
      rawAudioPath: `data/uploads/${storedName}`,
    }, ownerId);
  }

  return runPipeline(id, feedback, null, ownerId);
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["river"]);
  if ("response" in auth) return auth.response;

  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      return await handleMultipart(request, auth.session.userId);
    }
    return await handleJson(request, auth.session.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return fail(errorStatus(err), message);
  }
}

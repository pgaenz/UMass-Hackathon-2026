import { promises as fs } from "node:fs";
import path from "node:path";

import { base64FromBuffer, isWav, readWavInfo } from "@/lib/audio";
import { openAudioChat } from "@/lib/audio-chat";
import { config } from "@/lib/config";
import { buildConversationMessages } from "@/lib/conversation-context";
import { appendTurn, getConversation } from "@/lib/conversations";
import { authorize } from "@/lib/session";
import { sseResponse } from "@/lib/sse";
import { transcribe } from "@/lib/transcribe";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

function errorStatus(err: unknown): number {
  return err instanceof Error && err.message.startsWith("OpenRouter") ? 502 : 500;
}

interface TranscriptionResult {
  text: string;
  status: "ok" | "failed";
}

function bufferToWavBlob(buffer: Buffer): Blob {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return new Blob([copy.buffer], { type: "audio/wav" });
}

async function transcribeTurn(
  audio: Blob,
  filename: string,
  fallbackText: string,
): Promise<TranscriptionResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = (await transcribe(audio, filename)).trim();
      if (text) {
        return { text, status: "ok" };
      }
    } catch {
      // Retry once; a failed transcript must not lose the senior's recording.
    }
  }
  return fallbackText
    ? { text: fallbackText, status: "ok" }
    : { text: "", status: "failed" };
}

// POST /api/conversation/[id]/turn — multipart audio (WAV) and/or text.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorize(["river"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) {
    return fail(404, "Unknown conversation");
  }
  if (conversation.userId && conversation.userId !== auth.session.userId) {
    return fail(403, "This conversation belongs to another River.");
  }
  if (conversation.status !== "active") {
    return fail(409, "This conversation has already ended");
  }

  const formData = await request.formData();
  const audio = formData.get("audio");
  const rawText = formData.get("text");
  const text = typeof rawText === "string" ? rawText.trim() : "";

  let buffer: Buffer | null = null;
  let audioPath: string | null = null;
  let durationMs = 0;

  if (audio instanceof File && audio.size > 0) {
    if (audio.size > MAX_AUDIO_BYTES) {
      return fail(400, "That recording is too long. Please keep it under 15 MB.");
    }
    buffer = Buffer.from(await audio.arrayBuffer());
    if (!isWav(buffer)) {
      return fail(400, "Audio must be a WAV recording");
    }
    const info = readWavInfo(buffer);
    durationMs = info?.durationMs ?? 0;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const storedName = `conversation-${id}-${Date.now()}.wav`;
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer);
    audioPath = `data/uploads/${storedName}`;
  }

  if (!buffer && !text) {
    return fail(400, "Missing audio or text");
  }

  const transcriptionPromise: Promise<TranscriptionResult> = buffer
    ? transcribeTurn(bufferToWavBlob(buffer), "turn.wav", text)
    : Promise.resolve({ text, status: "ok" });

  const audioBase64 = buffer ? base64FromBuffer(buffer) : null;

  let upstream;
  try {
    const messages = await buildConversationMessages(conversation, {
      audioBase64,
      text,
    });
    upstream = await openAudioChat(messages, request.signal);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reach the interviewer";
    return fail(errorStatus(err), message);
  }

  return sseResponse(request.signal, async (send, signal) => {
    let assistantText = "";
    let usage: unknown = null;
    let completed = false;

    try {
      for await (const event of upstream.events) {
        if (signal.aborted) break;
        if (event.type === "text") {
          assistantText += event.text;
          send("assistant_delta", { text: event.text });
        } else if (event.type === "audio") {
          send("audio", {
            data: base64FromBuffer(event.data),
            sampleRate: config.audioSampleRate,
          });
        } else if (event.type === "usage") {
          usage = event.usage;
        }
      }
      completed = true;
    } catch (err) {
      if (!signal.aborted) {
        throw err;
      }
    } finally {
      // Persist the senior's words even if they leave mid-response. For the
      // normal path this runs after the assistant has finished speaking.
      if (completed || signal.aborted) {
        const user = await transcriptionPromise;
        const appended = await appendTurn(id, {
          user: {
            text: user.text,
            audioPath: audioPath ?? "",
            durationMs,
            transcriptionStatus: user.status,
          },
          assistant: {
            text: assistantText.trim(),
            interrupted: signal.aborted,
          },
        });

        if (!signal.aborted) {
          send("done", {
            turn: appended?.turn ?? null,
            userText: user.text,
            assistantText: assistantText.trim(),
            transcriptionStatus: user.status,
            usage,
          });
        }
      }
    }
  });
}

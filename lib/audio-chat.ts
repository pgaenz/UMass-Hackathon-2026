import { config } from "./config";

const REQUEST_TIMEOUT_MS = 120_000;

export type AudioChatContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: "wav" } };

export interface AudioChatMessage {
  role: "system" | "user" | "assistant";
  content: string | AudioChatContentPart[];
}

export type AudioChatEvent =
  | { type: "text"; text: string }
  | { type: "audio"; data: Buffer }
  | { type: "usage"; usage: unknown };

interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      audio?: { data?: string; transcript?: string };
    };
    finish_reason?: string | null;
  }>;
  usage?: unknown;
  error?: { message?: string };
}

export interface AudioChatStream {
  events: AsyncGenerator<AudioChatEvent>;
}

function parseErrorBody(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Fall through to the raw body.
  }
  return raw.slice(0, 500);
}

/**
 * Opens a native speech-to-speech response. Audio output requires streaming and
 * OpenRouter currently only supports raw PCM16 while streaming (not wav/mp3).
 */
export async function openAudioChat(
  messages: AudioChatMessage[],
  signal: AbortSignal,
): Promise<AudioChatStream> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = AbortSignal.any([signal, timeout]);

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      "Content-Type": "application/json",
      "X-Title": "HistorAI",
    },
    body: JSON.stringify({
      model: config.audioModel,
      modalities: ["text", "audio"],
      audio: { voice: config.audioVoice, format: "pcm16" },
      stream: true,
      temperature: 0.7,
      max_tokens: 300,
      messages,
    }),
    signal: combined,
  });

  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    const detail = raw ? `: ${parseErrorBody(raw)}` : "";
    throw new Error(`OpenRouter audio chat failed (HTTP ${res.status})${detail}`);
  }

  return { events: parseSse(res.body, combined) };
}

async function* parseSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<AudioChatEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) {
        throw new DOMException("Audio chat aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        yield* parseEventBlock(block);
        boundary = buffer.indexOf("\n\n");
      }
    }

    if (buffer.trim()) {
      yield* parseEventBlock(buffer);
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Reader already closed or aborted.
    }
  }
}

function* parseEventBlock(block: string): Generator<AudioChatEvent> {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return;
  }

  const payload = dataLines.join("\n");
  if (!payload || payload === "[DONE]") {
    return;
  }

  let chunk: StreamChunk;
  try {
    chunk = JSON.parse(payload) as StreamChunk;
  } catch {
    return;
  }

  if (chunk.error) {
    throw new Error(
      `OpenRouter audio chat failed: ${chunk.error.message ?? "unknown upstream error"}`,
    );
  }

  const delta = chunk.choices?.[0]?.delta;
  if (delta) {
    const text = delta.audio?.transcript || delta.content || "";
    if (text) {
      yield { type: "text", text };
    }

    if (delta.audio?.data) {
      yield { type: "audio", data: Buffer.from(delta.audio.data, "base64") };
    }
  }

  if (chunk.usage) {
    yield { type: "usage", usage: chunk.usage };
  }
}

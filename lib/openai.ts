import { config } from "./config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const DEFAULT_TEMPERATURE = 0.4;
const REQUEST_TIMEOUT_MS = 30_000;

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function chat(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {},
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? config.llmModel,
      messages,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = (await res.json().catch(() => null)) as ChatCompletionResponse | null;

  if (!res.ok) {
    const detail = body?.error?.message ? `: ${body.error.message}` : "";
    throw new Error(`OpenRouter chat failed (HTTP ${res.status})${detail}`);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter chat returned no content");
  }
  return content;
}

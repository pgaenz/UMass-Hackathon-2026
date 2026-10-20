import { config } from "./config";

const REQUEST_TIMEOUT_MS = 60_000;

interface TranscriptionResponse {
  text?: string;
  error?: { message?: string };
}

export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", audio, filename);
  formData.append("model", config.sttModel);

  const res = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = (await res.json().catch(() => null)) as TranscriptionResponse | null;

  if (!res.ok) {
    const detail = body?.error?.message ? `: ${body.error.message}` : "";
    throw new Error(`OpenRouter transcription failed (HTTP ${res.status})${detail}`);
  }

  if (!body?.text) {
    throw new Error("OpenRouter transcription returned no text");
  }
  return body.text;
}

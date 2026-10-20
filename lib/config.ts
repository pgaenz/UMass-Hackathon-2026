export const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_LLM_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_STT_MODEL = "openai/whisper-large-v3-turbo";
export const DEFAULT_TTS_MODEL = "google/gemini-3.8-flash-lite-tts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and set it.`,
    );
  }
  return value;
}

export const config = {
  openrouterApiKey: requireEnv("OPENROUTER_API_KEY"),
  baseUrl: process.env.BASE_URL || DEFAULT_BASE_URL,
  llmModel: process.env.LLM_MODEL || DEFAULT_LLM_MODEL,
  sttModel: process.env.STT_MODEL || DEFAULT_STT_MODEL,
  ttsModel: process.env.TTS_MODEL || DEFAULT_TTS_MODEL,
};

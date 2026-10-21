export const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_LLM_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_STT_MODEL = "openai/whisper-large-v3-turbo";
export const DEFAULT_TTS_MODEL = "google/gemini-3.8-flash-lite-tts";
export const DEFAULT_AUDIO_MODEL = "openai/gpt-audio-mini";
export const DEFAULT_AUDIO_VOICE = "sage";
export const DEFAULT_AUDIO_SAMPLE_RATE = 24_000;

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
  audioModel: process.env.AUDIO_MODEL || DEFAULT_AUDIO_MODEL,
  audioVoice: process.env.AUDIO_VOICE || DEFAULT_AUDIO_VOICE,
  audioSampleRate: Number(process.env.AUDIO_SAMPLE_RATE) || DEFAULT_AUDIO_SAMPLE_RATE,
  maxConversationTurns: Number(process.env.CONVERSATION_MAX_TURNS) || 12,
  maxConversationAudioHistory:
    Number(process.env.CONVERSATION_MAX_AUDIO_HISTORY_TURNS) || 2,
};

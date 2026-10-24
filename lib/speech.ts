/**
 * Small wrapper around the Web Speech API shared by every Listen button.
 * Text is split into sentence-sized chunks so long answers keep flowing and
 * pause/resume/stop apply to the whole reading.
 */

export type SpeechStatus = "idle" | "playing" | "paused";

export interface SpeechSnapshot {
  id: string | null;
  status: SpeechStatus;
}

const IDLE: SpeechSnapshot = { id: null, status: "idle" };

let snapshot: SpeechSnapshot = IDLE;
let token = 0;
let chunks: string[] = [];
let chunkIndex = 0;
let activeId: string | null = null;

const listeners = new Set<(state: SpeechSnapshot) => void>();

function publish(next: SpeechSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener(next);
}

export function subscribeSpeech(listener: (state: SpeechSnapshot) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSpeechSnapshot(): SpeechSnapshot {
  return snapshot;
}

/** The server always renders the idle state; real state is read on hydration. */
export function getSpeechServerSnapshot(): SpeechSnapshot {
  return IDLE;
}

function speechAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let voiceCache: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (!speechAvailable()) return;
  try {
    voiceCache = window.speechSynthesis.getVoices();
  } catch {
    voiceCache = [];
  }
}

if (typeof window !== "undefined" && speechAvailable()) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

export function getPreferredSpeechVoice(): SpeechSynthesisVoice | null {
  return pickVoice();
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (voiceCache.length === 0) refreshVoices();
  const english = voiceCache.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const pool = english.length > 0 ? english : voiceCache;

  // Prefer the more natural-sounding system voices when they exist.
  const preferredNames = [
    /natural/i,
    /aria/i,
    /jenny/i,
    /samantha/i,
    /google us english/i,
    /google uk english female/i,
    /karen/i,
    /daniel/i,
  ];

  for (const pattern of preferredNames) {
    const match = pool.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }

  return pool.find((voice) => voice.default) ?? pool[0] ?? null;
}

/** Split on sentence boundaries, then group short sentences into natural chunks. */
function splitIntoChunks(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const sentences =
    cleaned.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ??
    [cleaned];

  const result: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (`${current} ${sentence}`.length <= 220) {
      current = `${current} ${sentence}`;
      continue;
    }
    result.push(current);
    current = sentence;
  }

  if (current) result.push(current);
  return result;
}

function playNext(myToken: number) {
  if (!speechAvailable() || myToken !== token || !activeId) return;

  if (chunkIndex >= chunks.length) {
    activeId = null;
    publish(IDLE);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  // A normal pace reads naturally; punctuation gives the pauses.
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onend = () => {
    if (myToken !== token) return;
    chunkIndex += 1;
    playNext(myToken);
  };

  utterance.onerror = (event) => {
    if (myToken !== token) return;
    if (event.error === "interrupted" || event.error === "canceled") return;
    stopSpeech();
  };

  window.speechSynthesis.speak(utterance);
}

export function startSpeech(id: string, text: string): void {
  if (!speechAvailable() || !text.trim()) return;

  token += 1;
  const myToken = token;
  window.speechSynthesis.cancel();

  activeId = id;
  chunks = splitIntoChunks(text);
  chunkIndex = 0;

  if (chunks.length === 0) {
    activeId = null;
    publish(IDLE);
    return;
  }

  publish({ id, status: "playing" });

  // Some browsers need a tick after cancel() before accepting a new utterance.
  window.setTimeout(() => playNext(myToken), 60);
}

export function pauseSpeech(): void {
  if (!speechAvailable() || !activeId || snapshot.status !== "playing") return;
  window.speechSynthesis.pause();
  publish({ id: activeId, status: "paused" });
}

export function resumeSpeech(): void {
  if (!speechAvailable() || !activeId || snapshot.status !== "paused") return;
  window.speechSynthesis.resume();
  publish({ id: activeId, status: "playing" });
}

export function stopSpeech(): void {
  if (!speechAvailable()) return;
  token += 1;
  activeId = null;
  chunks = [];
  chunkIndex = 0;
  window.speechSynthesis.cancel();
  publish(IDLE);
}

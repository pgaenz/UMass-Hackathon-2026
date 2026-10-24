"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import type { PodcastPlan } from "@/lib/podcast-types";
import {
  getPreferredSpeechVoice,
  getSpeechServerSnapshot,
  getSpeechSnapshot,
  stopSpeech,
  subscribeSpeech,
} from "@/lib/speech";

const WORDS_PER_MINUTE = 150;
const SECONDS_BACK = 15;

interface ScriptChunk {
  text: string;
  start: number;
  duration: number;
  chapterTitle: string;
}

interface ScriptChapter {
  title: string;
  start: number;
  duration: number;
}

type PlaybackStatus = "idle" | "playing" | "paused" | "finished";

function words(text: string): number {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return (
    clean.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ??
    [clean]
  );
}

function makeChunks(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const sentence of splitSentences(text)) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (`${current} ${sentence}`.length <= 180) {
      current = `${current} ${sentence}`;
      continue;
    }
    chunks.push(current);
    current = sentence;
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildScript(plan: PodcastPlan): {
  chunks: ScriptChunk[];
  chapters: ScriptChapter[];
  duration: number;
} {
  const blocks: Array<{ title: string; text: string }> = [
    { title: "Introduction", text: plan.intro },
    ...plan.segments.flatMap((segment) => [
      { title: segment.title, text: segment.hostLeadIn },
      { title: segment.title, text: segment.storyText },
      { title: segment.title, text: segment.hostReflection },
    ]),
    { title: "Closing", text: plan.outro },
  ];

  const chunks: ScriptChunk[] = [];
  const chapters: ScriptChapter[] = [];
  let elapsed = 0;

  for (const block of blocks) {
    const chapterStart = elapsed;
    for (const text of makeChunks(block.text)) {
      const duration = Math.max(1, (words(text) / WORDS_PER_MINUTE) * 60);
      chunks.push({
        text,
        start: elapsed,
        duration,
        chapterTitle: block.title,
      });
      elapsed += duration;
    }
    if (elapsed > chapterStart) {
      chapters.push({
        title: block.title,
        start: chapterStart,
        duration: elapsed - chapterStart,
      });
    }
  }

  return { chunks, chapters, duration: elapsed };
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function findChunkIndex(chunks: ScriptChunk[], seconds: number): number {
  if (chunks.length === 0) return 0;
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    if (chunks[index].start <= seconds) return index;
  }
  return 0;
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5L8 5.5Z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" />
    </svg>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M3 10a9 9 0 1 1 2.6 7.1" strokeLinecap="round" />
      <path d="M3 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ForwardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M21 10a9 9 0 1 0-2.6 7.1" strokeLinecap="round" />
      <path d="M21 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CaptionsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M8 10h3M8 14h3M14 10h3M14 14h3" strokeLinecap="round" />
    </svg>
  );
}

/** A single-track player for the spoken episode, with a seek bar and chapters. */
export function PodcastPlayer({ plan }: { plan: PodcastPlan }) {
  const script = useMemo(() => buildScript(plan), [plan]);
  const speech = useSyncExternalStore(
    subscribeSpeech,
    getSpeechSnapshot,
    getSpeechServerSnapshot,
  );

  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [chunkIndex, setChunkIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(true);

  const tokenRef = useRef(0);
  const tickerRef = useRef<number | null>(null);
  const tickerBaseRef = useRef(0);
  const tickerStartedAtRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const elapsedRef = useRef(0);
  const statusRef = useRef<PlaybackStatus>("idle");
  const restartOnPlayRef = useRef(false);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const totalDuration = script.duration;
  const currentChunk = script.chunks[chunkIndex] ?? null;

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    chunkIndexRef.current = chunkIndex;
  }, [chunkIndex]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  function clearTicker() {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  function startTicker(from: number) {
    clearTicker();
    tickerBaseRef.current = from;
    tickerStartedAtRef.current = performance.now();
    tickerRef.current = window.setInterval(() => {
      const index = chunkIndexRef.current;
      const chunk = script.chunks[index];
      if (!chunk) return;
      const next = tickerBaseRef.current + (performance.now() - tickerStartedAtRef.current) / 1000;
      const capped = Math.min(chunk.start + chunk.duration, next);
      elapsedRef.current = capped;
      setElapsed(capped);
    }, 250);
  }

  function speakFrom(index: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    const chunk = script.chunks[index];
    if (!chunk) return;

    stopSpeech(); // silence any article Listen button
    tokenRef.current += 1;
    const token = tokenRef.current;
    window.speechSynthesis.cancel();
    clearTicker();

    setError(null);
    setChunkIndex(index);
    chunkIndexRef.current = index;
    setElapsed(chunk.start);
    elapsedRef.current = chunk.start;
    setStatus("playing");
    statusRef.current = "playing";
    restartOnPlayRef.current = false;

    const utterance = new SpeechSynthesisUtterance(chunk.text);
    const voice = getPreferredSpeechVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "en-US";
    }
    utterance.rate = 0.98;
    utterance.pitch = 1;
    activeUtteranceRef.current = utterance;

    utterance.onstart = () => {
      if (token === tokenRef.current) startTicker(chunk.start);
    };
    utterance.onboundary = (event) => {
      if (token !== tokenRef.current) return;
      const fraction =
        chunk.text.length > 0 ? Math.min(1, event.charIndex / chunk.text.length) : 0;
      tickerBaseRef.current = chunk.start + fraction * chunk.duration;
      tickerStartedAtRef.current = performance.now();
    };
    utterance.onend = () => {
      if (token !== tokenRef.current) return;
      clearTicker();
      const next = index + 1;
      if (next < script.chunks.length) {
        speakFrom(next);
        return;
      }
      setElapsed(totalDuration);
      elapsedRef.current = totalDuration;
      setStatus("finished");
      statusRef.current = "finished";
      activeUtteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      if (token !== tokenRef.current) return;
      if (event.error === "interrupted" || event.error === "canceled") return;
      clearTicker();
      setStatus("paused");
      statusRef.current = "paused";
      restartOnPlayRef.current = true;
      setError("Playback stopped. Press play to continue.");
    };

    // Chrome occasionally needs a tick after cancel() before speaking again.
    window.setTimeout(() => {
      if (token === tokenRef.current) window.speechSynthesis.speak(utterance);
    }, 50);
  }

  function pause() {
    if (status === "playing" && typeof window !== "undefined") {
      window.speechSynthesis.pause();
      clearTicker();
      setStatus("paused");
      statusRef.current = "paused";
    }
  }

  function play() {
    if (!supported) return;
    if (status === "playing") {
      pause();
      return;
    }
    if (status === "paused" && !restartOnPlayRef.current) {
      window.speechSynthesis.resume();
      setStatus("playing");
      statusRef.current = "playing";
      startTicker(elapsedRef.current);
      return;
    }
    const startIndex =
      status === "finished" ? 0 : findChunkIndex(script.chunks, elapsedRef.current);
    speakFrom(startIndex);
  }

  function stop() {
    tokenRef.current += 1;
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    clearTicker();
    activeUtteranceRef.current = null;
    setStatus("idle");
    statusRef.current = "idle";
    setChunkIndex(0);
    chunkIndexRef.current = 0;
    setElapsed(0);
    elapsedRef.current = 0;
    restartOnPlayRef.current = true;
    setError(null);
  }

  function seekTo(seconds: number) {
    const target = Math.max(0, Math.min(totalDuration, seconds));
    const index = findChunkIndex(script.chunks, target);
    const chunk = script.chunks[index];
    const targetElapsed = chunk ? Math.max(chunk.start, target) : target;

    tokenRef.current += 1;
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    clearTicker();
    setChunkIndex(index);
    chunkIndexRef.current = index;
    setElapsed(targetElapsed);
    elapsedRef.current = targetElapsed;
    restartOnPlayRef.current = true;

    if (status === "playing") {
      speakFrom(index);
    } else if (status === "finished") {
      setStatus("idle");
      statusRef.current = "idle";
    }
  }

  function backFifteen() {
    seekTo(elapsedRef.current - SECONDS_BACK);
  }

  function forwardFifteen() {
    seekTo(elapsedRef.current + SECONDS_BACK);
  }

  // Another Listen button taking over should stop this player.
  useEffect(() => {
    if (speech.id !== null && statusRef.current === "playing") {
      tokenRef.current += 1;
      clearTicker();
      setStatus("idle");
      statusRef.current = "idle";
      setElapsed(0);
      elapsedRef.current = 0;
      setChunkIndex(0);
      chunkIndexRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.id]);

  // A new episode replaces the old script and stops playback.
  useEffect(() => {
    tokenRef.current += 1;
    window.speechSynthesis?.cancel();
    clearTicker();
    setStatus("idle");
    statusRef.current = "idle";
    setChunkIndex(0);
    chunkIndexRef.current = 0;
    setElapsed(0);
    elapsedRef.current = 0;
    setError(null);
    restartOnPlayRef.current = true;
    return () => {
      tokenRef.current += 1;
      window.speechSynthesis?.cancel();
      clearTicker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  if (!supported) {
    return (
      <div className="rounded-2xl border border-coral/40 bg-coral/10 px-5 py-4 text-base text-ink/80">
        This browser does not support spoken playback. Try Chrome, Edge, or Safari.
      </div>
    );
  }

  const progressPercent =
    totalDuration > 0 ? Math.min(100, (elapsed / totalDuration) * 100) : 0;
  const isPlaying = status === "playing";
  const isFinished = status === "finished";
  const currentChapter = currentChunk?.chapterTitle ?? script.chapters[0]?.title ?? "Episode";

  return (
    <section
      aria-labelledby="podcast-player-heading"
      className="space-y-5 rounded-3xl border border-white/60 bg-ocean p-5 text-white shadow-water-lg sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-seaglass">
            Now listening
          </p>
          <h3 id="podcast-player-heading" className="mt-1 text-2xl font-bold">
            {plan.title}
          </h3>
          <p className="mt-1 text-base text-white/70">
            {currentChapter} · {formatClock(elapsed)} / {formatClock(totalDuration)}
          </p>
        </div>
        <span
          role="status"
          aria-live="polite"
          className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-seaglass"
        >
          {isFinished ? "Finished" : isPlaying ? "Playing" : status === "paused" ? "Paused" : "Ready"}
        </span>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={Math.max(1, totalDuration)}
          step={1}
          value={Math.min(elapsed, totalDuration)}
          onChange={(event) => seekTo(Number(event.target.value))}
          aria-label="Podcast position"
          aria-valuetext={`${formatClock(elapsed)} of ${formatClock(totalDuration)}`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-sunset"
          style={{
            background: `linear-gradient(to right, #e3a23c ${progressPercent}%, rgba(255,255,255,0.25) ${progressPercent}%)`,
          }}
        />
        <div className="flex justify-between text-sm tabular-nums text-white/65">
          <span>{formatClock(elapsed)}</span>
          <span>{formatClock(totalDuration)}</span>
        </div>
      </div>

      {showSubtitles ? (
        <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-seaglass">
              {currentChapter}
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-white/50">
              Subtitles on
            </p>
          </div>
          <p className="mt-1 text-lg leading-relaxed text-white/95">
            {currentChunk?.text ?? "Press play to start the episode."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={play}
          aria-label={isPlaying ? "Pause podcast" : isFinished ? "Replay podcast" : "Play podcast"}
          className="grid h-16 w-16 place-items-center rounded-full bg-sunset text-ocean shadow-water transition hover:brightness-105"
        >
          {isPlaying ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="h-7 w-7 translate-x-0.5" />}
        </button>

        <button
          type="button"
          onClick={backFifteen}
          disabled={elapsed <= 0}
          aria-label="Go back 15 seconds"
          title="Back 15 seconds"
          className="relative grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <BackIcon className="h-6 w-6" />
          <span className="absolute text-[0.55rem] font-bold leading-none" aria-hidden="true">
            15
          </span>
        </button>

        <button
          type="button"
          onClick={forwardFifteen}
          disabled={elapsed >= totalDuration - 0.5}
          aria-label="Skip forward 15 seconds"
          title="Forward 15 seconds"
          className="relative grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ForwardIcon className="h-6 w-6" />
          <span className="absolute text-[0.55rem] font-bold leading-none" aria-hidden="true">
            15
          </span>
        </button>

        <button
          type="button"
          onClick={stop}
          disabled={status === "idle" && elapsed === 0}
          aria-label="Stop podcast"
          title="Stop"
          className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-coral/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <StopIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowSubtitles((current) => !current)}
          aria-pressed={showSubtitles}
          aria-label={showSubtitles ? "Hide subtitles" : "Show subtitles"}
          className={cn(
            "inline-flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
            showSubtitles
              ? "border-seaglass/60 bg-seaglass/20 text-white"
              : "border-white/25 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white",
          )}
        >
          <CaptionsIcon className="h-5 w-5" />
          Subtitles
        </button>

        <p className="ml-auto text-sm text-white/65">
          {isFinished
            ? "Press play to listen again."
            : "Natural voice · skip back or ahead 15 seconds · drag the bar to move."}
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-coral/20 px-4 py-3 text-base text-white">
          {error}
        </p>
      ) : null}

      <details className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white/85">
        <summary className="cursor-pointer text-base font-semibold">Chapters</summary>
        <ol className="mt-3 space-y-2">
          {script.chapters.map((chapter, index) => (
            <li key={`${chapter.title}-${index}`}>
              <button
                type="button"
                onClick={() => seekTo(chapter.start)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-base transition hover:bg-white/10"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-5 shrink-0 text-sm tabular-nums text-seaglass">
                    {index + 1}
                  </span>
                  <span className="truncate">{chapter.title}</span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-white/60">
                  {formatClock(chapter.start)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
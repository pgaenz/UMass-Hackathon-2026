"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import { textActionBaseClass } from "@/lib/action-classes";
import { cn } from "@/lib/cn";
import {
  getSpeechServerSnapshot,
  getSpeechSnapshot,
  pauseSpeech,
  resumeSpeech,
  startSpeech,
  stopSpeech,
  subscribeSpeech,
} from "@/lib/speech";

const DEFAULT_ACTION =
  "text-ink/70 decoration-seaglass hover:text-ink hover:decoration-ink";
const ICON_ACTION =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-lg p-0 transition hover:bg-white/70";
const ICON_UNDERLINE =
  "after:absolute after:inset-x-1 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-current after:content-['']";
const TEXT_ICON_ACTION =
  "relative inline-flex items-center justify-center px-1 py-1 text-base font-medium text-transparent underline underline-offset-4";

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
      <path d="M18 6a9 9 0 0 1 0 12" strokeLinecap="round" />
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

function ResumeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l12-7.5-12-7.5Z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/**
 * Reads a question, answer, comment, or story aloud with the browser's voice.
 * Pressing Listen swaps in separate Pause and Stop controls.
 */
export function ListenButton({
  text,
  context,
  compact = false,
  className,
}: {
  text: string;
  context?: string;
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const speech = useSyncExternalStore(
    subscribeSpeech,
    getSpeechSnapshot,
    getSpeechServerSnapshot,
  );
  const [available, setAvailable] = useState(true);
  const activeRef = useRef(false);

  const isActive = speech.id === id;
  const status = isActive ? speech.status : "idle";
  activeRef.current = isActive;

  useEffect(() => {
    setAvailable(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
  }, []);

  // Navigating away should silence the previous page.
  useEffect(() => {
    return () => {
      if (activeRef.current) stopSpeech();
    };
  }, []);

  if (!available || !text.trim()) return null;

  const description = context ? `: ${context}` : "";
  const playLabel = context ? `Listen${description}` : "Listen";

  if (isActive) {
    const paused = status === "paused";

    if (compact) {
      return (
        <span className={cn("inline-flex shrink-0 items-center", className)}>
          <button
            type="button"
            onClick={paused ? resumeSpeech : pauseSpeech}
            aria-label={paused ? `Resume${description}` : `Pause${description}`}
            title={paused ? "Resume" : "Pause"}
            className={cn(ICON_ACTION, ICON_UNDERLINE, "text-success")}
          >
            {paused ? (
              <ResumeIcon className="-translate-y-[4px] h-4 w-4" />
            ) : (
              <PauseIcon className="-translate-y-[4px] h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={stopSpeech}
            aria-label={`Stop${description}`}
            title="Stop"
            className={cn(ICON_ACTION, ICON_UNDERLINE, "text-coral")}
          >
            <StopIcon className="-translate-y-[4px] h-4 w-4" />
          </button>
        </span>
      );
    }

    // The transparent two-letter labels reserve exactly one line of text, so
    // the underline sits on the same baseline as Copy, Share, and Report.
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        <button
          type="button"
          onClick={paused ? resumeSpeech : pauseSpeech}
          aria-label={paused ? `Resume${description}` : `Pause${description}`}
          title={paused ? "Resume" : "Pause"}
          className={cn(TEXT_ICON_ACTION, "decoration-success")}
        >
          <span aria-hidden="true">Pau</span>
          {paused ? (
            <ResumeIcon className="absolute left-1/2 top-[calc(50%-4px)] h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-success" />
          ) : (
            <PauseIcon className="absolute left-1/2 top-[calc(50%-4px)] h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-success" />
          )}
        </button>
        <button
          type="button"
          onClick={stopSpeech}
          aria-label={`Stop${description}`}
          title="Stop"
          className={cn(TEXT_ICON_ACTION, "decoration-coral")}
        >
          <span aria-hidden="true">Sto</span>
          <StopIcon className="absolute left-1/2 top-[calc(50%-4px)] h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-coral" />
        </button>
      </span>
    );
  }

  if (compact) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        <button
          type="button"
          onClick={() => startSpeech(id, text)}
          aria-label={context ? `Listen to ${context}` : "Listen"}
          title={playLabel}
          className={cn(ICON_ACTION, "ripple text-ink/70 hover:text-ink")}
        >
          <SpeakerIcon className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <button
        type="button"
        onClick={() => startSpeech(id, text)}
        aria-label={context ? `Listen to ${context}` : "Listen"}
        title={playLabel}
        className={cn(textActionBaseClass, DEFAULT_ACTION)}
      >
        <span className="inline-flex items-center gap-1.5">
          <SpeakerIcon className="h-4 w-4" />
          Listen
        </span>
      </button>
    </span>
  );
}
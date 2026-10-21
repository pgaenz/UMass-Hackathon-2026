"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { ConversationRecorder } from "@/lib/client/conversation-recorder";
import { PcmPlayer } from "@/lib/client/pcm-player";
import { consumeSse } from "@/lib/client/sse";
import { cn } from "@/lib/cn";
import type { CreateConversationResponse } from "@/lib/types";

type Phase =
  | "idle"
  | "starting"
  | "greeting"
  | "listening"
  | "recording"
  | "thinking"
  | "speaking"
  | "ending"
  | "writing"
  | "error";

interface ChatLine {
  id: string;
  role: "assistant" | "user";
  text: string;
}

interface DoneEvent {
  userText?: string;
  assistantText?: string;
  transcriptionStatus?: "ok" | "failed";
}

interface StreamResult {
  assistantText: string;
  done: DoneEvent | null;
}

const PHASE_LABELS: Record<Phase, string> = {
  idle: "Ready when you are.",
  starting: "Getting ready…",
  greeting: "Your interviewer is saying hello…",
  listening: "I’m listening. Take your time.",
  recording: "I hear you. Take your time.",
  thinking: "Let me think about that…",
  speaking: "Speaking…",
  ending: "Saving your conversation…",
  writing: "Writing your story…",
  error: "Something went wrong.",
};

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function VoiceConversation({
  questionId,
  questionText,
}: {
  questionId: string;
  questionText: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [storyId, setStoryId] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const recorderRef = useRef<ConversationRecorder | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      recorderRef.current?.stop();
      playerRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (phase !== "recording") {
      return;
    }
    const startedAt = Date.now();
    setRecordingSeconds(0);
    const timer = setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [phase]);

  async function runStream(
    url: string,
    init: RequestInit,
  ): Promise<StreamResult> {
    const controller = new AbortController();
    abortRef.current = controller;
    let assistantText = "";
    let done: DoneEvent | null = null;

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `The interviewer could not respond (HTTP ${res.status}).`);
      }

      await consumeSse(
        res,
        async ({ event, data }) => {
          if (event === "assistant_delta") {
            const text = (data as { text?: string })?.text ?? "";
            if (!text) return;
            assistantText += text;
            if (mountedRef.current) {
              setDraft(assistantText);
              setPhase("speaking");
            }
            return;
          }

          if (event === "audio") {
            const audio = data as { data?: string; sampleRate?: number };
            if (audio?.data && playerRef.current) {
              if (mountedRef.current) setPhase("speaking");
              await playerRef.current.playBase64(
                audio.data,
                audio.sampleRate ?? 24_000,
              );
            }
            return;
          }

          if (event === "done") {
            done = data as DoneEvent;
            return;
          }

          if (event === "error") {
            const message = (data as { error?: string })?.error;
            throw new Error(message || "The interviewer stopped responding.");
          }
        },
        controller.signal,
      );

      return { assistantText, done };
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  async function resumeListening(): Promise<void> {
    await playerRef.current?.waitForIdle();
    if (!mountedRef.current || endedRef.current) {
      return;
    }
    setDraft("");
    setError(null);
    recorderRef.current?.setEnabled(true);
    setPhase("listening");
  }

  async function sendTurn(audio: Blob, durationMs: number): Promise<void> {
    const conversationId = conversationIdRef.current;
    if (!conversationId) {
      return;
    }

    recorderRef.current?.setEnabled(false);
    setPhase("thinking");
    setError(null);
    setDraft("");

    const formData = new FormData();
    formData.append("audio", audio, "turn.wav");
    formData.append("durationMs", String(durationMs));

    try {
      const result = await runStream(`/api/conversation/${conversationId}/turn`, {
        method: "POST",
        body: formData,
      });

      const userText = result.done?.userText?.trim() ?? "";
      const assistantText = result.assistantText.trim();
      const additions: ChatLine[] = [];
      if (userText) {
        additions.push({ id: newId(), role: "user", text: userText });
      }
      if (assistantText) {
        additions.push({ id: newId(), role: "assistant", text: assistantText });
      }
      if (mountedRef.current && additions.length > 0) {
        setLines((previous) => [...previous, ...additions]);
      }

      await resumeListening();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      if (!mountedRef.current) return;
      setDraft("");
      setError(err instanceof Error ? err.message : "The conversation stopped.");
      setPhase("error");
    }
  }

  async function startConversation(): Promise<void> {
    setPhase("starting");
    setError(null);
    setLines([]);
    setDraft("");
    setStoryId(null);
    endedRef.current = false;
    conversationIdRef.current = null;

    try {
      const player = new PcmPlayer();
      playerRef.current = player;
      await player.ensure();

      const recorder = new ConversationRecorder({
        onSpeechStart: () => {
          if (!mountedRef.current) return;
          setPhase("recording");
        },
        onSpeechEnd: (audio, durationMs) => {
          if (!audio) {
            setPhase("listening");
            recorderRef.current?.setEnabled(true);
            return;
          }
          void sendTurn(audio, durationMs);
        },
        onLevel: () => undefined,
      });
      recorderRef.current = recorder;
      await recorder.start();
      recorder.setEnabled(false);

      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: questionText, questionId }),
      });
      const body = (await res.json().catch(() => null)) as
        | (CreateConversationResponse & { error?: string })
        | null;
      if (!res.ok || !body?.conversation) {
        throw new Error(body?.error ?? "We could not start the conversation.");
      }

      conversationIdRef.current = body.conversation.id;
      if (mountedRef.current) {
        setStoryId(body.story?.id ?? null);
        setPhase("greeting");
      }

      const greeting = await runStream(
        `/api/conversation/${body.conversation.id}/greet`,
        { method: "POST" },
      );

      const text = greeting.assistantText.trim();
      if (mountedRef.current && text) {
        setLines([{ id: newId(), role: "assistant", text }]);
      }
      await resumeListening();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      conversationIdRef.current = null;
      await recorderRef.current?.stop();
      recorderRef.current = null;
      await playerRef.current?.close();
      playerRef.current = null;
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : "We could not reach your microphone or the interviewer.",
      );
      setPhase("error");
    }
  }

  async function endConversation(): Promise<void> {
    const conversationId = conversationIdRef.current;
    if (!conversationId) {
      return;
    }

    abortRef.current?.abort();
    recorderRef.current?.setEnabled(false);
    recorderRef.current?.stop();
    recorderRef.current = null;
    playerRef.current?.stop();
    setPhase("ending");
    setError(null);
    setDraft("");

    // Give an aborted turn a moment to persist its partial transcript.
    await new Promise((resolve) => setTimeout(resolve, 400));

    try {
      const res = await fetch(`/api/conversation/${conversationId}/end`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        story?: { id: string };
      } | null;
      if (!res.ok || !body?.story) {
        throw new Error(body?.error ?? "We could not save your conversation.");
      }

      endedRef.current = true;
      if (mountedRef.current) {
        setStoryId(body.story.id);
        setPhase("writing");
      }

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: body.story.id }),
      });
      const genBody = (await genRes.json().catch(() => null)) as { error?: string } | null;
      if (!genRes.ok) {
        throw new Error(genBody?.error ?? "We saved the conversation, but could not write the story.");
      }

      router.push(`/senior/review/${body.story.id}`);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "We could not save the conversation.");
      setPhase("error");
    }
  }

  function retry(): void {
    if (
      conversationIdRef.current &&
      !endedRef.current &&
      recorderRef.current
    ) {
      setError(null);
      recorderRef.current.setEnabled(true);
      setPhase("listening");
      return;
    }
    void startConversation();
  }

  const started = phase !== "idle";
  const busy =
    phase === "starting" ||
    phase === "greeting" ||
    phase === "thinking" ||
    phase === "speaking" ||
    phase === "ending" ||
    phase === "writing";

  return (
    <section className="space-y-6 rounded-2xl glass shadow-water p-6 shadow-sm sm:p-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          A conversation, not a form
        </p>
        <h2 className="text-2xl font-bold text-ink sm:text-3xl">
          Tell your story out loud
        </h2>
        <p className="text-lg leading-relaxed text-ink/70">
          A patient interviewer will greet you, ask the question, and listen. Pause as
          long as you need — it will wait for you.
        </p>
        <p className="rounded-xl bg-seaglass/25 px-4 py-3 text-base text-ink/75">
          This conversation is recorded so we can write your story. You can stop at any
          time.
        </p>
      </div>

      {!started ? (
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" onClick={startConversation}>
            Start conversation
          </Button>
          <span className="text-base text-ink/75">
            Uses your microphone. You can end whenever you like.
          </span>
        </div>
      ) : (
        <div className="space-y-5">
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3 text-lg font-semibold",
              phase === "error"
                ? "bg-brand/15 text-ocean"
                : phase === "recording"
                  ? "bg-seaglass/25 text-ocean"
                  : "bg-brand/10 text-ocean",
            )}
          >
            <span>{PHASE_LABELS[phase]}</span>
            {phase === "recording" ? (
              <span className="tabular-nums text-base font-medium">
                {Math.floor(recordingSeconds / 60)}:
                {(recordingSeconds % 60).toString().padStart(2, "0")}
              </span>
            ) : null}
            {phase === "recording" ? <span aria-hidden="true">●</span> : null}
          </div>

          <div
            className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-seaglass/40 bg-seaglass/20 p-4"
            aria-label="Conversation transcript"
          >
            {lines.length === 0 && !draft ? (
              <p className="text-base text-ink/75">The conversation will appear here.</p>
            ) : null}
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  "rounded-xl px-4 py-3 text-lg leading-relaxed",
                  line.role === "assistant"
                    ? "glass text-ink"
                    : "ml-6 bg-brand/10 text-ink",
                )}
              >
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/75">
                  {line.role === "assistant" ? "Interviewer" : "You"}
                </p>
                {line.text}
              </div>
            ))}
            {draft ? (
              <div className="rounded-xl glass px-4 py-3 text-lg leading-relaxed text-ink shadow-sm">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink/75">
                  Interviewer
                </p>
                {draft}
                <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-brand align-middle" />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              onClick={endConversation}
              disabled={phase === "ending" || phase === "writing"}
            >
              {phase === "ending" || phase === "writing"
                ? "Saving…"
                : "End conversation & write my story"}
            </Button>
            {started ? (
              <span className="text-base text-ink/75">
                The story is yours to review before anything is published.
              </span>
            ) : null}
          </div>

          {error ? (
            <div
              role="alert"
              className="space-y-3 rounded-xl bg-brand/15 px-4 py-3 text-lg text-ocean"
            >
              <p>{error}</p>
              <div className="flex flex-wrap gap-3">
                {storyId && endedRef.current ? (
                  <ButtonLink href={`/senior/review/${storyId}`} variant="secondary">
                    Open the saved story
                  </ButtonLink>
                ) : (
                  <Button variant="secondary" onClick={retry} disabled={busy}>
                    {conversationIdRef.current ? "Keep talking" : "Try again"}
                  </Button>
                )}
                <Link
                  href="/senior"
                  className="inline-flex min-h-11 items-center text-base font-semibold text-brand hover:underline"
                >
                  Choose another question
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

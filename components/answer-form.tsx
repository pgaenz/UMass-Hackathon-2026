"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Mode = "text" | "audio";
type Status = { kind: "idle" | "error" | "success" | "loading"; message?: string };

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AnswerForm({
  questionId,
  questionText,
}: {
  questionId: string;
  questionText: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function resetAudio() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setSeconds(0);
  }

  async function startRecording() {
    resetAudio();
    setStatus({ kind: "idle" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      setStatus({
        kind: "error",
        message: "We could not reach your microphone. You can type your answer instead.",
      });
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  async function submitBody(body: BodyInit, headers?: HeadersInit) {
    setSubmitting(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/intake", { method: "POST", headers, body });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        story?: { id: string };
      } | null;
      if (!res.ok || !data?.story) {
        throw new Error(data?.error ?? "We could not save your answer.");
      }

      // Submission triggers the whole pipeline: write the article, then review it.
      setStatus({ kind: "loading", message: "Writing your story and checking it for accuracy…" });
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.story.id }),
      });
      const genData = (await genRes.json().catch(() => null)) as { error?: string } | null;
      if (!genRes.ok) {
        throw new Error(genData?.error ?? "We could not write your story.");
      }

      router.push(`/senior/review/${data.story.id}`);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      setStatus({ kind: "error", message: "Please write your answer before submitting." });
      return;
    }
    await submitBody(
      JSON.stringify({ inputType: "text", prompt: questionText, questionId, text }),
      { "Content-Type": "application/json" },
    );
    setText("");
  }

  async function handleAudioSubmit() {
    if (!blobRef.current) {
      setStatus({ kind: "error", message: "Record an answer first." });
      return;
    }
    const formData = new FormData();
    formData.append("audio", blobRef.current, "answer.webm");
    formData.append("prompt", questionText);
    formData.append("questionId", questionId);
    await submitBody(formData);
    resetAudio();
  }

  return (
    <section
      aria-labelledby="answer-heading"
      data-tour="answer-form"
      className="space-y-5 rounded-2xl glass shadow-water p-6 shadow-sm"
    >
      <div className="space-y-2">
        <h2 id="answer-heading" className="text-2xl font-semibold text-ink">
          Your answer
        </h2>
        <p className="text-lg text-ink/70">
          Record it out loud or type it. You can review it before it is published.
        </p>
      </div>

      <div
        className="flex flex-col gap-4 rounded-xl border border-seaglass bg-seaglass/25 p-4 sm:flex-row sm:items-center sm:justify-between"
        data-tour="interviewer"
      >
        <div className="space-y-1">
          <p className="text-lg font-semibold text-ink">Prefer a conversation?</p>
          <p className="text-base text-ink/70">
            Talk it through with a patient interviewer. It waits while you think.
          </p>
        </div>
        <ButtonLink
          href={`/senior/conversation?question=${encodeURIComponent(questionId)}`}
          variant="secondary"
        >
          Talk with an interviewer
        </ButtonLink>
      </div>

      <div
        className="flex flex-wrap gap-3"
        role="group"
        aria-label="Answer method"
        data-tour="answer-modes"
      >
        {(["text", "audio"] as Mode[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            data-tour={option === "audio" ? "record-mode" : "type-mode"}
            onClick={() => setMode(option)}
            className={cn(
              "ripple min-h-12 rounded-xl border-2 px-5 py-2.5 text-lg font-semibold transition",
              mode === option
                ? "border-brand bg-brand text-white"
                : "border-2 border-seaglass bg-white/60 text-ink backdrop-blur hover:border-brand hover:bg-white/80",
            )}
          >
            {option === "text" ? "Type" : "Record"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="answer-text" className="text-lg font-semibold text-ink">
              Your answer
            </label>
            <textarea
              id="answer-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              placeholder="Tell the story in your own words…"
              className="w-full rounded-xl border-2 border-seaglass p-4 text-lg leading-relaxed text-ink placeholder:text-ink/75 focus:border-brand"
            />
          </div>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Sending…" : "Submit answer"}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            {!recording ? (
              <Button size="lg" onClick={startRecording}>
                {audioUrl ? "Record again" : "Start recording"}
              </Button>
            ) : (
              <Button size="lg" variant="secondary" onClick={stopRecording}>
                Stop recording
              </Button>
            )}
            <span
              role="timer"
              aria-live="off"
              className={cn(
                "text-2xl font-bold tabular-nums",
                recording ? "text-brand" : "text-ink",
              )}
            >
              {formatSeconds(seconds)}
            </span>
            {recording ? (
              <span className="text-lg font-medium text-brand" aria-live="polite">
                Recording…
              </span>
            ) : null}
          </div>

          {audioUrl ? (
            <div className="space-y-2">
              <p className="text-lg font-medium text-ink">Preview your recording</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={audioUrl} className="w-full" />
              <Button size="lg" onClick={handleAudioSubmit} disabled={submitting}>
                {submitting ? "Sending…" : "Submit recording"}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {status.kind === "error" ? (
        <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
          {status.message}
        </p>
      ) : null}
      {status.kind === "loading" ? (
        <p role="status" className="rounded-lg bg-brand/10 px-4 py-3 text-lg font-medium text-ocean">
          {status.message}
        </p>
      ) : null}
      {status.kind === "success" ? (
        <p role="status" className="rounded-lg bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}

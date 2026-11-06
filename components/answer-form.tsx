"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Mode = "text" | "audio";
type Status = { kind: "idle" | "error" | "success" | "loading"; message?: string };
type Phase = "idle" | "saving" | "writing";

const STEPS: { id: Phase; label: string }[] = [
  { id: "saving", label: "Saving your answer" },
  { id: "writing", label: "Writing and checking your story" },
];

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
  const [phase, setPhase] = useState<Phase>("idle");

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasUnsent = Boolean(text.trim()) || Boolean(audioUrl);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Warn before the browser leaves with an answer that is not saved yet.
  useEffect(() => {
    if (!hasUnsent || submitting) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsent, submitting]);

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
        message: "We could not reach your microphone. Choose Type your answer to write it instead.",
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

  /** Saves the answer only. Never calls the AI. Returns the story id or null. */
  async function saveAnswer(body: BodyInit, headers?: HeadersInit): Promise<string | null> {
    setSubmitting(true);
    setStatus({ kind: "idle" });
    setPhase("saving");
    try {
      const res = await fetch("/api/intake", { method: "POST", headers, body });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        transcriptionFailed?: boolean;
        story?: { id: string };
      } | null;
      if (!res.ok || !data?.story) {
        throw new Error(data?.error ?? "We could not save your answer.");
      }
      // The answer is now safely stored; clearing it can no longer lose work.
      setText("");
      resetAudio();
      if (data.transcriptionFailed) {
        router.push(`/senior/review/${data.story.id}?transcriptionFailed=1`);
        return data.story.id;
      }
      return data.story.id;
    } catch (err) {
      // Keep the text and recording so the River can retry.
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
      return null;
    } finally {
      setPhase("idle");
      setSubmitting(false);
    }
  }

  async function saveForLater(body: BodyInit, headers?: HeadersInit) {
    const id = await saveAnswer(body, headers);
    if (!id) return;
    router.push("/senior/stories?notice=saved");
  }

  async function writeMyStory(body: BodyInit, headers?: HeadersInit) {
    const id = await saveAnswer(body, headers);
    if (!id) return;
    // The form already navigated away on transcription failure.
    setPhase("writing");
    setStatus({ kind: "loading", message: "Writing your story…" });
    try {
      await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // The answer is saved; the review page offers "Write my story" again.
    }
    router.push(`/senior/review/${id}`);
  }

  function textBody(): BodyInit {
    return JSON.stringify({ inputType: "text", prompt: questionText, questionId, text });
  }

  function audioFormData(): FormData {
    const formData = new FormData();
    if (blobRef.current) formData.append("audio", blobRef.current, "answer.webm");
    formData.append("prompt", questionText);
    formData.append("questionId", questionId);
    return formData;
  }

  async function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      setStatus({ kind: "error", message: "Please write your answer before saving it." });
      return;
    }
    await writeMyStory(textBody(), { "Content-Type": "application/json" });
  }

  async function handleTextSaveLater() {
    if (!text.trim()) {
      setStatus({ kind: "error", message: "Please write your answer before saving it." });
      return;
    }
    await saveForLater(textBody(), { "Content-Type": "application/json" });
  }

  async function handleAudio(action: "write" | "save") {
    if (!blobRef.current) {
      setStatus({ kind: "error", message: "Record an answer first." });
      return;
    }
    const body = audioFormData();
    if (action === "write") {
      await writeMyStory(body);
    } else {
      await saveForLater(body);
    }
  }

  const working = submitting || phase !== "idle";

  const actions = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          onClick={() =>
            mode === "text"
              ? handleTextSaveLater()
              : handleAudio("save")
          }
          variant="secondary"
          disabled={working}
        >
          Save answer for later
        </Button>
        <Button
          size="lg"
          onClick={() => (mode === "text" ? undefined : handleAudio("write"))}
          type={mode === "text" ? "submit" : "button"}
          disabled={working}
        >
          {phase === "writing" ? "Writing…" : "Write my story"}
        </Button>
      </div>
      <p className="text-base text-ink/70">
        Saving keeps your answer in My stories. Nothing is written or published until you choose.
      </p>
    </div>
  );

  return (
    <section
      aria-labelledby="answer-heading"
      data-tour="answer-form"
      className="space-y-6 rounded-2xl glass shadow-water p-6 shadow-sm"
    >
      <div className="space-y-2">
        <h2 id="answer-heading" className="text-2xl font-semibold text-ink">
          Your answer
        </h2>
        <p className="text-lg text-ink/70">
          Speak naturally or type in your own words. Save it for later, or write the story when
          you are ready.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-3"
        role="group"
        aria-label="How would you like to answer?"
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
            {option === "text" ? "Type your answer" : "Record your answer"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="answer-text" className="text-lg font-semibold text-ink">
              What you want to say
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
          {actions}
        </form>
      ) : (
        <div className="space-y-5">
          <p className="rounded-xl bg-seaglass/25 px-4 py-3 text-base text-ink/80">
            Your browser may ask to use your microphone. Choose <strong>Allow</strong> so we can
            hear you. You can listen to your recording before saving it, and you can switch to
            typing at any time.
          </p>

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
            <div className="space-y-4">
              <p className="text-lg font-medium text-ink">Preview your recording</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={audioUrl} className="w-full" />
              {actions}
            </div>
          ) : null}
        </div>
      )}

      {phase !== "idle" ? (
        <ol role="status" className="space-y-2 rounded-xl bg-brand/10 px-4 py-3">
          {STEPS.map((step) => {
            const activeIndex = STEPS.findIndex((item) => item.id === phase);
            const stepIndex = STEPS.findIndex((item) => item.id === step.id);
            const done = stepIndex < activeIndex;
            const current = stepIndex === activeIndex;
            return (
              <li key={step.id} className="flex items-center gap-2 text-lg text-ocean">
                <span aria-hidden="true">{done ? "✓" : current ? "•" : "○"}</span>
                <span className={current ? "font-semibold" : ""}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

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

      <div
        className="rounded-xl border border-seaglass/60 bg-white/50 p-4"
        data-tour="interviewer"
      >
        <p className="text-base font-semibold text-ink">Optional: talk with an interviewer</p>
        <p className="mt-1 text-base text-ink/70">
          Prefer to tell the story out loud? A patient interviewer asks one question at a time,
          waits while you think, and helps turn the conversation into your answer.
        </p>
        <ButtonLink
          href={`/senior/conversation?question=${encodeURIComponent(questionId)}`}
          variant="secondary"
          className="mt-3"
        >
          Talk with an interviewer
        </ButtonLink>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CheckAgainButton } from "@/components/check-again-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Mode = "text" | "audio";
type Busy = "idle" | "regenerating" | "publishing";
type Notice = { kind: "error" | "success"; message: string } | null;

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ReviewActions({
  storyId,
  passed,
  safetyBlocked,
  publishReady,
  answerChanged,
  checkedAt,
}: {
  storyId: string;
  passed: boolean;
  safetyBlocked: boolean;
  publishReady: boolean;
  answerChanged: boolean;
  checkedAt: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("text");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<Busy>("idle");
  const [notice, setNotice] = useState<Notice>(null);

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
    setNotice(null);
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
      setNotice({
        kind: "error",
        message: "We could not reach your microphone. You can type your feedback instead.",
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

  async function regenerate() {
    setBusy("regenerating");
    setNotice(null);
    try {
      let res: Response;
      if (mode === "audio" && blobRef.current) {
        const formData = new FormData();
        formData.append("id", storyId);
        if (feedback.trim()) formData.append("feedback", feedback.trim());
        formData.append("feedbackAudio", blobRef.current, "feedback.webm");
        res = await fetch("/api/generate", { method: "POST", body: formData });
      } else {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: storyId, feedback: feedback.trim() }),
        });
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not re-create the story.");
      }
      setFeedback("");
      resetAudio();
      setNotice({ kind: "success", message: "We wrote a new version and checked it again." });
      router.refresh();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy("idle");
    }
  }

  async function publish() {
    setBusy("publishing");
    setNotice(null);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: storyId, override: !passed }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not publish the story.");
      }
      setNotice({
        kind: "success",
        message: "Your story is published. You can find it on Read stories.",
      });
      router.refresh();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy("idle");
    }
  }

  const working = busy !== "idle";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="recreate-heading" className="space-y-4 rounded-2xl glass shadow-water p-6 shadow-sm">
        <div className="space-y-1">
          <h2 id="recreate-heading" className="text-2xl font-semibold text-ink">
            Ask for a change
          </h2>
          <p className="text-lg text-ink/70">
            Tell us what does not sound right. We will write a new story from your answer and
            check it again before you decide.
          </p>
        </div>

        <div className="flex flex-wrap gap-3" role="group" aria-label="Feedback method">
          {(["text", "audio"] as Mode[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
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
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={4}
            placeholder="Optional: what would you like changed?"
            aria-label="Your feedback"
            className="w-full rounded-xl border-2 border-seaglass p-4 text-lg leading-relaxed text-ink placeholder:text-ink/75 focus:border-brand"
          />
        ) : (
          <div className="space-y-4">
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
                className={cn("text-2xl font-bold tabular-nums", recording ? "text-brand" : "text-ink")}
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
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio controls src={audioUrl} className="w-full" />
            ) : null}
          </div>
        )}

        <Button size="lg" onClick={regenerate} disabled={working}>
          {busy === "regenerating" ? "Writing a new version…" : "Ask for a change"}
        </Button>
      </section>

      <section aria-labelledby="publish-heading" className="space-y-4 rounded-2xl glass shadow-water p-6 shadow-sm">
        <h2 id="publish-heading" className="text-2xl font-semibold text-ink">
          Publish this story
        </h2>
        {safetyBlocked ? (
          <p className="rounded-xl bg-brand/15 px-4 py-3 text-lg text-ocean">
            This story contains something that cannot be published, so there is no publish button.
            Edit the story to remove the flagged part, or change your answer.
          </p>
        ) : !publishReady ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-sunset/30 px-4 py-3 text-lg text-ink">
              {answerChanged
                ? "Your answer changed after this story was written. Write the story again before publishing."
                : "This story has not been checked yet. Check it again before publishing."}
            </p>
            {answerChanged ? null : <CheckAgainButton storyId={storyId} />}
          </div>
        ) : passed ? (
          <p className="rounded-xl bg-seaglass/40 px-4 py-3 text-lg text-ocean">
            The accuracy and clarity check passed. Publishing puts this story on Read stories,
            where anyone can see it.
          </p>
        ) : (
          <p className="rounded-xl bg-seaglass/25 px-4 py-3 text-lg text-ocean">
            The accuracy and clarity check found something to fix. You can ask for a change, or
            publish anyway — it is your story. Publishing anyway shows it exactly as written
            above.
          </p>
        )}
        {safetyBlocked || !publishReady ? null : (
          <Button
            size="lg"
            variant={passed ? "primary" : "secondary"}
            onClick={publish}
            disabled={working}
          >
            {busy === "publishing" ? "Publishing…" : passed ? "Publish this story" : "Publish anyway"}
          </Button>
        )}
        {safetyBlocked ? null : (
          <p className="text-base text-ink/70">
            Nothing is published unless you choose it.
          </p>
        )}
        <Link
          href="/senior/stories"
          className="inline-block text-base font-semibold text-brand hover:underline"
        >
          Back to My stories
        </Link>
      </section>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg px-4 py-3 text-lg font-medium lg:col-span-2",
            notice.kind === "error" ? "bg-brand/15 text-ocean" : "bg-seaglass/40 text-ocean",
          )}
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}

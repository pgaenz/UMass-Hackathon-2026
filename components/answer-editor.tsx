"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const TRANSCRIPT_MAX = 20_000;

type Notice = { kind: "status" | "error"; message: string } | null;

/**
 * Inline answer editor (plan/river-experience.md §8.3). Saving the answer makes
 * no AI call; the story is only written again when the River asks.
 */
export function AnswerEditor({
  storyId,
  transcript,
  updatedAt,
  hasArticle,
  previousArticle,
  answerChanged,
}: {
  storyId: string;
  transcript: string;
  updatedAt: string;
  hasArticle: boolean;
  previousArticle: string | null;
  answerChanged: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(transcript);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [rewriteOpen, setRewriteOpen] = useState(answerChanged && hasArticle);

  async function saveAnswer() {
    const trimmed = text.trim();
    if (!trimmed) {
      setNotice({ kind: "error", message: "Please write your answer before saving." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: trimmed, expectedUpdatedAt: updatedAt }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not save your answer.");
      }
      setEditing(false);
      setNotice({ kind: "status", message: "Your answer is saved." });
      if (hasArticle) setRewriteOpen(true);
      router.refresh();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function writeAgain() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: storyId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not write the story again.");
      }
      setRewriteOpen(false);
      setNotice({ kind: "status", message: "We wrote the story again from your answer." });
      router.refresh();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/restore`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not restore the previous version.");
      }
      setNotice({ kind: "status", message: "We put your previous version back." });
      router.refresh();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {editing ? (
        <section aria-label="Edit your answer" className="space-y-3">
          <p className="text-base text-ink/80">Fix any words that were heard wrongly.</p>
          <label htmlFor={`answer-text-${storyId}`} className="text-lg font-semibold text-ink">
            Your answer
          </label>
          <textarea
            id={`answer-text-${storyId}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            className="w-full rounded-xl border-2 border-seaglass bg-white/70 p-4 text-lg leading-relaxed text-ink focus:border-brand"
          />
          {text.length > TRANSCRIPT_MAX * 0.9 ? (
            <p className={text.length > TRANSCRIPT_MAX ? "text-sm font-medium text-coral" : "text-sm text-ink/70"}>
              {text.length} of {TRANSCRIPT_MAX} characters
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={saveAnswer} disabled={busy}>
              {busy ? "Saving…" : "Save my answer"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => { setText(transcript); setEditing(true); }}>
            Edit my answer
          </Button>
          {previousArticle ? (
            <Button variant="ghost" onClick={restore} disabled={busy}>
              Restore my previous version
            </Button>
          ) : null}
        </div>
      )}

      {rewriteOpen && hasArticle && !editing ? (
        <section
          aria-label="Write the story again"
          className="space-y-3 rounded-xl bg-sunset/25 px-4 py-4"
        >
          <p className="text-lg font-semibold text-ink">Your answer changed. Write the story again?</p>
          <p className="text-base text-ink/80">
            This replaces the story you see now, including your edits. The previous version is
            kept, so you can restore it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setRewriteOpen(false)} disabled={busy} autoFocus>
              Keep this version
            </Button>
            <Button onClick={writeAgain} disabled={busy}>
              {busy ? "Writing…" : "Write it again"}
            </Button>
          </div>
        </section>
      ) : null}

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error" ? "text-base font-medium text-coral" : "text-base font-medium text-ocean"
          }
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}

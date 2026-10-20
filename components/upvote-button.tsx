"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * Large, keyboard-friendly upvote control with an optimistic count.
 * A browser remembers its own vote so a question is not double-counted in the UI.
 */
export function UpvoteButton({
  questionId,
  initialCount,
}: {
  questionId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [pending, setPending] = useState(false);
  const storageKey = `historai:upvoted:${questionId}`;

  useEffect(() => {
    try {
      setVoted(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // Storage can be unavailable; voting simply stays available.
    }
  }, [storageKey]);

  async function handleClick() {
    if (voted || pending) return;
    setPending(true);
    setCount((current) => current + 1);
    try {
      const res = await fetch("/api/questions/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId }),
      });
      if (!res.ok) throw new Error("Upvote failed");
      const data = (await res.json()) as { question?: { upvotes?: number } };
      setCount(data.question?.upvotes ?? count + 1);
      setVoted(true);
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // Ignore storage failures.
      }
    } catch {
      setCount((current) => Math.max(0, current - 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={voted || pending}
      aria-pressed={voted}
      aria-label={voted ? `Upvoted. ${count} votes` : `Upvote this question. ${count} votes`}
      className={cn(
        "flex min-h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border-2 font-bold transition",
        voted
          ? "border-brand bg-brand text-white"
          : "border-orange-200 bg-surface text-brand hover:border-brand hover:bg-orange-50",
      )}
    >
      <span aria-hidden="true" className="text-xl leading-none">
        ▲
      </span>
      <span className="mt-1 text-lg leading-none" aria-live="polite">
        {count}
      </span>
    </button>
  );
}

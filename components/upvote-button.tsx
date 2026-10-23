"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { cn } from "@/lib/cn";
import type { VoteQuestionResponse } from "@/lib/types";

/**
 * Large, keyboard-friendly upvote control with an optimistic count.
 * The vote is tied to the signed-in user (see plan/UX-FIXES-2.md §6); the
 * server owns the truth and this component only mirrors it.
 */
export function UpvoteButton({
  questionId,
  initialCount,
  initialVoted = false,
  signedIn = false,
}: {
  questionId: string;
  initialCount: number;
  initialVoted?: boolean;
  signedIn?: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [pending, setPending] = useState(false);
  const clipId = `drop-${useId().replace(/:/g, "")}`;

  async function handleClick() {
    if (pending) return;
    if (!signedIn) {
      router.push("/login");
      return;
    }

    const next = !voted;
    setPending(true);
    setVoted(next);
    setCount((current) => Math.max(0, current + (next ? 1 : -1)));

    try {
      const res = await fetch("/api/questions/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: questionId, vote: next }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Upvote failed");

      const data = (await res.json()) as VoteQuestionResponse;
      setVoted(data.voted);
      setCount(data.count);
    } catch {
      // Revert the optimistic update.
      setVoted(!next);
      setCount((current) => Math.max(0, current + (next ? -1 : 1)));
    } finally {
      setPending(false);
    }
  }

  const dropPath = "M20 3 C 20 3 35 22 35 33 A 15 15 0 1 1 5 33 C 5 22 20 3 20 3 Z";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={voted}
      aria-label={voted ? `Upvoted. ${count} votes` : `Upvote this question. ${count} votes`}
      title={voted ? "Upvoted" : "Upvote"}
      className="ripple group relative flex h-20 w-16 shrink-0 items-center justify-center rounded-2xl"
    >
      <svg
        viewBox="0 0 40 52"
        className="h-16 w-16 transition-transform duration-200 group-hover:-translate-y-0.5 group-active:translate-y-0"
        aria-hidden="true"
      >
        {/* Clip the rising water to the droplet silhouette */}
        <defs>
          <clipPath id={clipId}>
            <path d={dropPath} />
          </clipPath>
        </defs>

        {/* Empty droplet shell */}
        <path
          d={dropPath}
          className="fill-white/70 stroke-seaglass stroke-2 transition-colors group-hover:stroke-accent"
        />

        {/* Liquid that fills from the bottom up */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="0"
            y="0"
            width="40"
            height="52"
            className={cn("liquid-fill fill-brand", !voted && "liquid-fill--empty")}
          />
        </g>

        {/* Crisp outline on top of the water */}
        <path
          d={dropPath}
          className="fill-none stroke-seaglass stroke-2 transition-colors group-hover:stroke-accent"
        />

        <path
          d="M20 24 l-4 5 h8 Z"
          className={cn(
            "transition-colors duration-500",
            voted ? "fill-white" : "fill-brand",
          )}
        />
        <text
          x="20"
          y="44"
          textAnchor="middle"
          className={cn(
            "text-[13px] font-bold transition-colors duration-500",
            voted ? "fill-white" : "fill-brand",
          )}
        >
          {count}
        </text>
      </svg>
      <span className="sr-only" aria-live="polite">
        {count} {count === 1 ? "vote" : "votes"}
      </span>
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LikeMatchDialog } from "@/components/like-match-dialog";
import { cn } from "@/lib/cn";
import type { LikeMatch, LikeStoryResponse } from "@/lib/types";

function wasMatchSeen(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markMatchSeen(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable; the pop-up simply may repeat.
  }
}

/**
 * Per-user like control with an optimistic count. On a successful like that
 * returns a match, opens the connection pop-up at most once per story per
 * browser session (plan/LIKES.md §2, decision 5).
 */
export function LikeButton({
  storyId,
  initialLiked,
  initialCount,
  signedIn,
}: {
  storyId: string;
  initialLiked: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [match, setMatch] = useState<LikeMatch | null>(null);
  const storageKey = `historai:likeMatchSeen:${storyId}`;

  async function handleClick() {
    if (pending) return;
    if (!signedIn) {
      router.push("/login");
      return;
    }

    const next = !liked;
    setPending(true);
    setLiked(next);
    setCount((current) => Math.max(0, current + (next ? 1 : -1)));

    try {
      const res = await fetch(`/api/stories/${storyId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ like: next }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error("Like failed");

      const data = (await res.json()) as LikeStoryResponse;
      setLiked(data.liked);
      setCount(data.count);

      if (data.liked && data.match && !wasMatchSeen(storageKey)) {
        markMatchSeen(storageKey);
        setMatch(data.match);
      }
    } catch {
      // Revert the optimistic update.
      setLiked(!next);
      setCount((current) => Math.max(0, current + (next ? -1 : 1)));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? `Liked. ${count} likes` : `Like this story. ${count} likes`}
        title="Like this story"
        className={cn(
          "ripple inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-1.5 text-base font-semibold transition",
          liked
            ? "border-coral bg-coral/10 text-coral"
            : "border-seaglass bg-white/60 text-ocean hover:border-brand hover:text-brand",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className={cn("h-5 w-5", liked ? "fill-coral" : "fill-none")}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20.5 4.6 13a5 5 0 0 1 7.1-7.1l.3.3.3-.3a5 5 0 0 1 7.1 7.1Z" />
        </svg>
        <span>{count}</span>
        <span className="sr-only" aria-live="polite">
          {count} {count === 1 ? "like" : "likes"}
        </span>
      </button>

      <LikeMatchDialog match={match} onClose={() => setMatch(null)} />
    </>
  );
}

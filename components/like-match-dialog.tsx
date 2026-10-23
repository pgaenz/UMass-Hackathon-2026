"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { ReportButton } from "@/components/report-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LikeMatch } from "@/lib/types";

/**
 * Post-like connection nudge (see plan/LIKES.md). A native <dialog> gives focus
 * trapping and Escape-to-close for free, matching ReportButton. "Say hello"
 * reuses the existing get-or-create thread endpoint.
 */
export function LikeMatchDialog({
  match,
  onClose,
}: {
  match: LikeMatch | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = `like-match-title-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (match && !dialog.open) {
      setError(null);
      dialog.showModal();
    } else if (!match && dialog.open) {
      dialog.close();
    }
  }, [match]);

  async function sayHello() {
    if (!match) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: match.user.id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { thread?: { id?: string }; error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error(data?.error ?? "Could not open the conversation.");
      }

      const threadId = data?.thread?.id;
      if (!threadId) throw new Error("Could not open the conversation.");
      router.push(`/messages/${threadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setConnecting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="w-[min(92vw,32rem)] rounded-2xl glass shadow-water p-0 shadow-xl"
    >
      {match ? (
        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <h2 id={titleId} className="text-2xl font-bold text-ink">
              {match.user.name} also liked this story.
            </h2>
            <p className="text-base text-ink/70">
              {match.sharedInterests.length > 0
                ? "You share some interests. Would you like to say hello?"
                : "Would you like to say hello?"}
            </p>
          </div>

          <div className="space-y-3 rounded-xl bg-white/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl font-semibold text-ink">{match.user.name}</span>
              <Badge>
                {match.user.role === "river" ? "River" : "Drop"} · {match.user.ageBand}
              </Badge>
            </div>

            {match.user.bio ? (
              <p className="text-base text-ink/80">{match.user.bio}</p>
            ) : null}

            {match.sharedInterests.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                  Interests you share
                </p>
                <ul className="flex flex-wrap gap-2" aria-label="Shared interests">
                  {match.sharedInterests.map((topic) => (
                    <li key={topic.id}>
                      <Badge className="bg-sunset/40 text-ocean">{topic.label}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-coral">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ReportButton targetType="user" targetId={match.user.id} />
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
                Not now
              </Button>
              <Button onClick={sayHello} disabled={connecting}>
                {connecting ? "Opening…" : "Say hello"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

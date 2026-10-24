"use client";

import { useEffect, useRef, useState } from "react";

import { textActionBaseClass } from "@/lib/action-classes";
import { writeToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/cn";

type ShareState = "idle" | "shared" | "copied" | "error";

/**
 * Shares the current page as a link. On phones and browsers with the Web Share
 * API this opens the system share sheet; everywhere else the link is copied so
 * it can be pasted into a message or email.
 */
export function ShareButton({
  path,
  title,
  context,
  className,
}: {
  path: string;
  title: string;
  context?: string;
  className?: string;
}) {
  const [state, setState] = useState<ShareState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function scheduleReset() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), 2500);
  }

  async function copyFallback(url: string) {
    try {
      await writeToClipboard(url, buttonRef.current);
      setState("copied");
    } catch {
      setState("error");
    }
    scheduleReset();
  }

  async function share() {
    const url = new URL(path, window.location.origin).toString();

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        setState("shared");
        scheduleReset();
        return;
      } catch (err) {
        // Closing the share sheet is not an error; show nothing.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    await copyFallback(url);
  }

  const label =
    state === "shared"
      ? "Shared"
      : state === "copied"
        ? "Link copied"
        : state === "error"
          ? "Try again"
          : "Share";

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={share}
        title={context ? `Share: ${context}` : "Share"}
        aria-label={context ? `${label}: ${context}` : label}
        className={cn(
          textActionBaseClass,
          state === "shared" || state === "copied"
            ? "text-brand decoration-brand"
            : state === "error"
              ? "text-coral decoration-coral"
              : "text-ink/70 decoration-seaglass hover:text-ink hover:decoration-ink",
        )}
      >
        <span>{label}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "shared"
          ? "Shared"
          : state === "copied"
            ? "Link copied to clipboard"
            : state === "error"
              ? "Could not share. Please try again."
              : ""}
      </span>
    </span>
  );
}

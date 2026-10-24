"use client";

import { useEffect, useRef, useState } from "react";

import { textActionBaseClass } from "@/lib/action-classes";
import { writeToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/cn";

type CopyState = "idle" | "copied" | "error";

/**
 * Copy control styled like the other inline text actions (Report, Share). It
 * confirms success visually and through a live region so older users and
 * screen-reader users know the copy worked.
 */
export function CopyButton({
  text,
  context,
  compact = false,
  className,
}: {
  text: string;
  context?: string;
  compact?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy() {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await writeToClipboard(text, buttonRef.current);
      setState("copied");
    } catch {
      setState("error");
    }
    timerRef.current = setTimeout(() => setState("idle"), 2500);
  }

  const textLabel = state === "copied" ? "Copied" : state === "error" ? "Try again" : "Copy";
  const accessibleLabel = context ? `${textLabel}: ${context}` : textLabel;

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={copy}
        title={context ? `Copy: ${context}` : "Copy"}
        aria-label={accessibleLabel}
        className={cn(
          compact
            ? "ripple inline-flex h-9 w-9 items-center justify-center rounded-lg p-0"
            : textActionBaseClass,
          state === "copied"
            ? "text-brand decoration-brand"
            : state === "error"
              ? "text-coral decoration-coral"
              : compact
                ? "text-ink/70 hover:text-ink"
                : "text-ink/70 decoration-seaglass hover:text-ink hover:decoration-ink",
        )}
      >
        {compact ? (
          state === "copied" ? (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )
        ) : (
          <span>{textLabel}</span>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied"
          ? "Copied to clipboard"
          : state === "error"
            ? "Could not copy. Please try again."
            : ""}
      </span>
    </span>
  );
}

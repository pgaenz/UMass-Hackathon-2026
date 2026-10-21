"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

type TextSize = "base" | "large" | "xl";

const STORAGE_KEY = "crosscurrent:text-size";
const LEVELS: Array<{ id: TextSize; label: string; aria: string }> = [
  { id: "base", label: "A", aria: "Standard text size" },
  { id: "large", label: "A+", aria: "Large text size" },
  { id: "xl", label: "A++", aria: "Extra large text size" },
];

function applyTextSize(size: TextSize) {
  const root = document.documentElement;
  if (size === "base") {
    root.removeAttribute("data-text-size");
  } else {
    root.setAttribute("data-text-size", size);
  }
}

/**
 * Prominent A / A+ / A++ control that scales the whole rem-based interface.
 * The choice is remembered between visits.
 */
export function TextSizeToggle() {
  const [size, setSize] = useState<TextSize>("base");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable; the default size still applies.
    }
    if (saved === "base" || saved === "large" || saved === "xl") {
      setSize(saved);
      applyTextSize(saved);
    }
  }, []);

  function update(next: TextSize) {
    setSize(next);
    applyTextSize(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage failures.
    }
  }

  return (
    <div
      role="group"
      aria-label="Text size"
      className="flex items-center gap-0.5 rounded-xl border border-white/25 bg-white/10 p-0.5"
    >
      {LEVELS.map((level) => (
        <button
          key={level.id}
          type="button"
          aria-label={level.aria}
          aria-pressed={size === level.id}
          title={level.aria}
          onClick={() => update(level.id)}
          className={cn(
            "ripple grid h-9 min-w-9 place-items-center rounded-lg px-1.5 text-sm font-bold transition",
            size === level.id
              ? "bg-white text-ocean"
              : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          {level.label}
        </button>
      ))}
    </div>
  );
}

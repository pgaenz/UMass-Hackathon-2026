"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

export const POINTER_STORAGE_KEY = "historai:pointer-style";
export const POINTER_CHANGE_EVENT = "historai:pointer-change";

/** Preference is opt-in: only the exact value "water" enables the drop. */
export function readWaterPointerPreference(): boolean {
  try {
    return window.localStorage.getItem(POINTER_STORAGE_KEY) === "water";
  } catch {
    return false;
  }
}

/**
 * Opt-in switch for the themed pointer. Off by default so the native system
 * pointer (with its accessibility and magnifier support) is never hidden
 * unless the person asks for it.
 */
export function PointerToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readWaterPointerPreference());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try {
      window.localStorage.setItem(POINTER_STORAGE_KEY, next ? "water" : "system");
    } catch {
      // Storage can be unavailable; the switch still applies for this visit.
    }
    window.dispatchEvent(new CustomEvent(POINTER_CHANGE_EVENT, { detail: next }));
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={toggle}
      title="Use a water-drop pointer instead of the system pointer"
      className="ripple inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20"
    >
      <span>Water pointer</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-block h-5 w-9 shrink-0 rounded-full transition",
          enabled ? "bg-sunset" : "bg-white/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            enabled ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

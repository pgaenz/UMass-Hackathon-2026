"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useState } from "react";

import { cn } from "@/lib/cn";

const base =
  "ripple inline-flex items-center justify-center rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export function LogoutButton({
  compact = false,
  className,
  ...props
}: ComponentProps<"button"> & { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className={cn(
        base,
        compact
          ? "min-h-10 border border-white/20 bg-white/10 px-3 text-sm text-white hover:bg-white/20"
          : "min-h-11 border border-seaglass bg-white/60 px-5 py-2.5 text-base text-ocean backdrop-blur hover:border-brand hover:bg-white/80",
        className,
      )}
      {...props}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

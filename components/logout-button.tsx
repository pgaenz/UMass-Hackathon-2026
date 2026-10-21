"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useState } from "react";

import { cn } from "@/lib/cn";

const base =
  "inline-flex items-center justify-center rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

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
          ? "min-h-10 border border-orange-100 bg-canvas px-3 text-sm text-ink hover:bg-orange-50"
          : "min-h-11 border-2 border-orange-200 bg-surface px-5 py-2.5 text-base text-ink hover:border-brand hover:bg-orange-50",
        className,
      )}
      {...props}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

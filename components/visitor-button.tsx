"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VisitorButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      await fetch("/api/auth/visitor", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={enter}
      disabled={busy}
      className="ripple rounded-lg text-lg font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60"
    >
      {busy ? "Opening…" : "Just browsing? Continue as a visitor →"}
    </button>
  );
}

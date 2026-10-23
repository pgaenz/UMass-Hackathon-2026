"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Closes the thread from this user's side by blocking the other participant. */
export function BlockButton({
  threadId,
  name,
}: {
  threadId: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      `Block ${name}? They will no longer be able to message you, and this conversation will be closed.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/block`, { method: "POST" });
      if (!res.ok) throw new Error("Could not block this person.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="ripple rounded-lg px-2 py-1 text-base font-medium text-coral underline decoration-coral/50 underline-offset-4 hover:decoration-coral disabled:opacity-60"
      >
        {busy ? "Blocking…" : "Block"}
      </button>
      {error ? (
        <span role="alert" className="text-sm text-coral">
          {error}
        </span>
      ) : null}
    </span>
  );
}

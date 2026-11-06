"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Re-runs the article checks (plan/river-experience.md §7.2). */
export function CheckAgainButton({
  storyId,
  label = "Check again",
}: {
  storyId: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/check`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not check this story.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={check} disabled={busy}>
        {busy ? "Checking…" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-base font-medium text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

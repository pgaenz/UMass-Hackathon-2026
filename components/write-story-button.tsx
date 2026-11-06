"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Writes the story from a saved answer (plan/river-experience.md §8.2/§8.3). */
export function WriteStoryButton({ storyId }: { storyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function write() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: storyId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not write your story.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-base text-ink/70">
        We will write a story from your answer, then check it. Nothing is published until you
        choose to publish.
      </p>
      <Button size="lg" onClick={write} disabled={busy}>
        {busy ? "Writing your story…" : "Write my story"}
      </Button>
      {error ? (
        <p role="alert" className="text-base font-medium text-coral">
          {error}
        </p>
      ) : null}
    </div>
  );
}

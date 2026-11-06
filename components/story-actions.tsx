"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

type DialogKind = "unpublish" | "delete" | null;

/**
 * "Take off Read stories" and "Delete story", each behind a confirmation
 * (plan/river-experience.md §8.4).
 */
export function StoryActions({
  storyId,
  published,
}: {
  storyId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(kind: Exclude<DialogKind, null>) {
    setBusy(true);
    setError(null);
    try {
      const res =
        kind === "unpublish"
          ? await fetch(`/api/stories/${storyId}/unpublish`, { method: "POST" })
          : await fetch(`/api/stories/${storyId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong.");
      }
      setDialog(null);
      if (kind === "delete") {
        router.push("/senior/stories?notice=deleted");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {published ? (
          <Button variant="secondary" onClick={() => setDialog("unpublish")}>
            Take off Read stories
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="text-coral hover:bg-coral/10"
          onClick={() => setDialog("delete")}
        >
          Delete story
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-base font-medium text-coral">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={dialog === "unpublish"}
        title="Take off Read stories?"
        message="Readers will stop seeing this story. You can publish it again later."
        confirmLabel="Take off"
        cancelLabel="Keep publishing"
        busy={busy}
        onConfirm={() => request("unpublish")}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this story?"
        message={
          published
            ? "This permanently removes your answer and your story, and any recordings. Readers will no longer see it, and its likes will be removed. This cannot be undone."
            : "This permanently removes your answer and your story, and any recordings. This cannot be undone."
        }
        confirmLabel="Yes, delete it"
        cancelLabel="Keep story"
        busy={busy}
        destructive
        onConfirm={() => request("delete")}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

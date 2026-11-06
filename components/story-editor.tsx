"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

const ARTICLE_MAX = 30_000;

function splitArticle(article: string): { title: string; body: string } {
  const lines = article.split(/\r?\n/);
  const match = (lines[0] ?? "").match(/^#\s+(.*)$/);
  if (match) {
    return {
      title: match[1].trim(),
      body: lines.slice(1).join("\n").replace(/^\s*\n+/, ""),
    };
  }
  return { title: "", body: article };
}

type Notice = { kind: "status" | "error"; message: string } | null;

/**
 * Inline story editor (plan/river-experience.md §8.3). It is only shown after
 * the River chooses "Edit story", so text can never change by accident. The
 * edit is saved before any check runs.
 */
export function StoryEditor({
  storyId,
  article,
  updatedAt,
  published,
}: {
  storyId: string;
  article: string;
  updatedAt: string;
  published: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [conflict, setConflict] = useState(false);

  function startEditing() {
    const parts = splitArticle(article);
    setTitle(parts.title);
    setBody(parts.body);
    setNotice(null);
    setConflict(false);
    setEditing(true);
  }

  async function save() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setNotice({ kind: "error", message: "Please write your story before saving." });
      return;
    }
    const composed = trimmedTitle ? `# ${trimmedTitle}\n\n${trimmedBody}` : trimmedBody;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: composed, expectedUpdatedAt: updatedAt }),
      });
      if (res.status === 409) {
        setConflict(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not save your changes.");
      }
      setEditing(false);
      setNotice({ kind: "status", message: "Saved. We are checking it again." });
      router.refresh();
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        <Button variant="secondary" onClick={startEditing}>
          Edit story
        </Button>
        {notice ? (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={
              notice.kind === "error"
                ? "text-base font-medium text-coral"
                : "text-base font-medium text-ocean"
            }
          >
            {notice.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-label="Edit your story"
      className="space-y-4 rounded-2xl glass shadow-water p-6 shadow-sm"
    >
      <p className="text-base text-ink/80">
        Your changes are saved first. Then we check them again. You still decide whether to
        publish.
      </p>
      {published ? (
        <p className="rounded-xl bg-sunset/30 px-4 py-3 text-base text-ink">
          Saving takes this story off Read stories until you publish it again.
        </p>
      ) : null}
      {conflict ? (
        <div role="alert" className="space-y-3 rounded-xl bg-brand/15 px-4 py-3 text-base text-ocean">
          <p>This story changed in another window. Reload to see the latest version.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(false);
              router.refresh();
            }}
          >
            Reload
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor={`story-title-${storyId}`} className="text-lg font-semibold text-ink">
          Title
        </label>
        <input
          id={`story-title-${storyId}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border-2 border-seaglass bg-white/70 p-3 text-lg text-ink focus:border-brand"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor={`story-body-${storyId}`} className="text-lg font-semibold text-ink">
          Story
        </label>
        <textarea
          id={`story-body-${storyId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={14}
          aria-describedby={`story-body-help-${storyId}`}
          className="w-full rounded-xl border-2 border-seaglass bg-white/70 p-4 text-lg leading-relaxed text-ink focus:border-brand"
        />
         <p id={`story-body-help-${storyId}`} className="text-sm text-ink/70">
          Keep the story close to what you said. A passing check is not proof that a story is true.
        </p>
        {body.length > ARTICLE_MAX * 0.9 ? (
          <p className={body.length > ARTICLE_MAX ? "text-sm font-medium text-coral" : "text-sm text-ink/70"}>
            {body.length} of {ARTICLE_MAX} characters
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </Button>
      </div>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className="text-base font-medium text-coral"
        >
          {notice.message}
        </p>
      ) : null}
    </section>
  );
}

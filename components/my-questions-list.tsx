"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { MAX_QUESTION_LENGTH } from "@/lib/question-rules";
import type { DropQuestionStateId } from "@/lib/drop-question-state";
import type { Topic } from "@/lib/types";

export interface MyQuestionItem {
  id: string;
  text: string;
  topicIds: string[];
  labels: string[];
  stateId: DropQuestionStateId;
  stateLabel: string;
  storyId: string | null;
  edited: boolean;
  hasTopics: boolean;
  lastChanged: string;
  canChange: boolean;
}

const GROUPS: Array<{ id: DropQuestionStateId; heading: string }> = [
  { id: "waiting", heading: "Waiting for a River" },
  { id: "in_progress", heading: "A River is writing an answer" },
  { id: "answered", heading: "Answered" },
];

export function MyQuestionsList({
  items,
  topics,
  highlight,
}: {
  items: MyQuestionItem[];
  topics: Topic[];
  highlight?: string;
}) {
  const router = useRouter();
  const editDialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<MyQuestionItem | null>(null);
  const [editText, setEditText] = useState("");
  const [editTopics, setEditTopics] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState<MyQuestionItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const dialog = editDialog.current;
    if (!dialog) return;
    if (editing && !dialog.open) dialog.showModal();
    if (!editing && dialog.open) dialog.close();
  }, [editing]);

  function beginEdit(item: MyQuestionItem) {
    setEditing(item);
    setEditText(item.text);
    setEditTopics(item.topicIds);
    setEditError(null);
  }

  function toggleTopic(topicId: string) {
    setEditTopics((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId],
    );
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/questions/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText, topicIds: editTopics }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        notice?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not save your changes.");
      setFeedback(data?.notice ?? "Your changes were saved.");
      setEditing(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    if (!withdrawing) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/questions/${withdrawing.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not withdraw that question.");
      setFeedback("Your question was withdrawn.");
      setWithdrawing(null);
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Something went wrong.");
      setWithdrawing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {feedback ? (
        <p role="status" className="rounded-xl bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean">
          {feedback}
        </p>
      ) : null}

      {GROUPS.map((group) => {
        const list = items.filter((item) => item.stateId === group.id);
        if (list.length === 0) return null;
        return (
          <section key={group.id} aria-labelledby={`group-${group.id}`} className="space-y-4">
            <h2 id={`group-${group.id}`} className="text-2xl font-bold tracking-tight text-ink">
              {group.heading}{" "}
              <span className="text-lg font-semibold text-ink/70">({list.length})</span>
            </h2>
            <ul className="space-y-4">
              {list.map((item) => (
                <li
                  key={item.id}
                  id={item.id}
                  className={cn(
                    "scroll-mt-24 rounded-2xl glass shadow-water p-5 shadow-sm",
                    "target:ring-2 target:ring-brand",
                    item.id === highlight && "ring-2 ring-brand",
                  )}
                >
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold leading-snug text-ink">
                      <Link
                        href={`/questions/${item.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {item.text}
                      </Link>
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-base text-ink/70">
                      <Badge>{item.stateLabel}</Badge>
                      {item.edited ? <span className="font-medium">Edited</span> : null}
                      <span>Last changed {formatDate(item.lastChanged)}</span>
                      {!item.hasTopics ? <span>No topics yet</span> : null}
                    </div>
                    {item.labels.length > 0 ? (
                      <ul className="flex flex-wrap gap-2" aria-label="Topics">
                        {item.labels.map((label) => (
                          <li key={label}>
                            <Badge>{label}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {item.stateId === "answered" && item.storyId ? (
                        <ButtonLink href={`/youth/${item.storyId}`}>Read the story</ButtonLink>
                      ) : null}
                      {item.stateId === "waiting" ? (
                        <ButtonLink
                          href={
                            item.topicIds[0]
                              ? `/questions?topic=${item.topicIds[0]}&sort=unanswered`
                              : "/questions?sort=unanswered"
                          }
                          variant="secondary"
                        >
                          See similar questions
                        </ButtonLink>
                      ) : null}
                      <Button
                        variant="secondary"
                        onClick={() => beginEdit(item)}
                        disabled={!item.canChange}
                      >
                        Edit question
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setWithdrawing(item)}
                        disabled={!item.canChange}
                        className={item.canChange ? "border-coral text-coral" : undefined}
                      >
                        Withdraw question
                      </Button>
                    </div>
                    {!item.canChange ? (
                      <p className="text-base text-ink/70">
                        A River has started an answer, so this question can no longer be
                        changed or withdrawn.
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <dialog
        ref={editDialog}
        aria-labelledby="edit-question-heading"
        onClose={() => setEditing(null)}
        className="w-[min(94vw,40rem)] rounded-2xl glass shadow-water p-0 shadow-xl"
      >
        {editing ? (
          <form onSubmit={saveEdit} className="space-y-5 p-6">
            <h2 id="edit-question-heading" className="text-2xl font-bold text-ink">
              Edit your question
            </h2>
            <div className="space-y-2">
              <label htmlFor="edit-question-text" className="text-lg font-semibold text-ink">
                Your question
              </label>
              <textarea
                id="edit-question-text"
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={4}
                maxLength={MAX_QUESTION_LENGTH}
                aria-describedby="edit-question-count"
                className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink focus:border-brand"
              />
              <p id="edit-question-count" className="text-base text-ink/70">
                {editText.length} of {MAX_QUESTION_LENGTH}
              </p>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-lg font-semibold text-ink">Topics (choose any)</legend>
              <p className="text-base text-ink/70">Topics help Rivers find your question.</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => {
                  const active = editTopics.includes(topic.id);
                  return (
                    <label
                      key={topic.id}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-lg font-medium transition",
                        active
                          ? "border-brand bg-seaglass/25 text-ocean"
                          : "border-2 border-seaglass bg-white/60 text-ink hover:border-brand",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleTopic(topic.id)}
                        className="h-5 w-5"
                      />
                      {topic.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {editError ? (
              <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
                {editError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : null}
      </dialog>

      <ConfirmDialog
        open={Boolean(withdrawing)}
        title="Withdraw this question?"
        message="It will be removed for everyone. This cannot be undone."
        confirmLabel="Withdraw it"
        cancelLabel="Keep question"
        onConfirm={withdraw}
        onCancel={() => setWithdrawing(null)}
        busy={busy}
        destructive
      />
    </div>
  );
}

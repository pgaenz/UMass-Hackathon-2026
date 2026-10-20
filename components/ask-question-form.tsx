"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Topic } from "@/lib/types";

export function AskQuestionForm({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleTopic(topicId: string) {
    setSelectedTopics((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) {
      setError("Please write your question before posting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, topicIds: selectedTopics }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not post your question.");
      setText("");
      setSelectedTopics([]);
      setSuccess("Your question was posted. Thank you!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="ask-question-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="ask-question-heading" className="text-2xl font-semibold text-slate-900">
        Ask a question
      </h2>
      <p className="mt-2 text-lg text-slate-600">
        Ask something you would genuinely like a senior&apos;s perspective on.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="space-y-2">
          <label htmlFor="question-text" className="text-lg font-semibold text-slate-900">
            Your question
          </label>
          <textarea
            id="question-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={300}
            placeholder="What was your first job, and how did you get it?"
            aria-describedby="question-hint"
            className="w-full rounded-xl border-2 border-slate-300 p-4 text-lg text-slate-900 placeholder:text-slate-400 focus:border-sky-700"
          />
          <p id="question-hint" className="text-base text-slate-500">
            Up to 300 characters.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-slate-900">Topics (choose any)</legend>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const active = selectedTopics.includes(topic.id);
              return (
                <label
                  key={topic.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-lg font-medium transition",
                    active
                      ? "border-sky-700 bg-sky-50 text-sky-900"
                      : "border-slate-300 bg-white text-slate-700 hover:border-sky-700",
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

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-lg font-medium text-red-800">
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-lg font-medium text-green-900">
            {success}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Posting…" : "Post question"}
        </Button>
      </form>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Topic } from "@/lib/types";

export function AskQuestionForm({
  topics,
  canAsk,
  signedIn,
}: {
  topics: Topic[];
  canAsk: boolean;
  signedIn: boolean;
}) {
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
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        notice?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not post your question.");
      setText("");
      setSelectedTopics([]);
      setSuccess(data?.notice ?? "Your question was posted. Thank you!");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canAsk) {
    return (
      <section
        aria-labelledby="ask-question-heading"
        className="rounded-2xl border border-seaglass/40 bg-seaglass/25 p-6 shadow-sm"
      >
        <h2 id="ask-question-heading" className="text-2xl font-semibold text-ink">
          Ask a question
        </h2>
        <p className="mt-2 text-lg text-ink/70">
          {signedIn
            ? "Rivers answer questions. To ask one, sign in as a Drop."
            : "Sign in as a Drop to ask a question and learn from a River."}
        </p>
        <Link
          href={signedIn ? "/profile" : "/login"}
          className="ripple mt-4 inline-flex min-h-11 items-center rounded-xl bg-sunset px-5 font-bold text-ocean shadow-water transition hover:brightness-105"
        >
          {signedIn ? "Go to your profile" : "Sign in to ask"}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="ask-question-heading" className="rounded-2xl glass shadow-water p-6 shadow-sm">
      <h2 id="ask-question-heading" className="text-2xl font-semibold text-ink">
        Ask a question
      </h2>
      <p className="mt-2 text-lg text-ink/70">
        Ask something you would genuinely like a senior&apos;s perspective on.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="space-y-2">
          <label htmlFor="question-text" className="text-lg font-semibold text-ink">
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
            className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          />
          <p id="question-hint" className="text-base text-ink/70">
            Up to 300 characters.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-ink">Topics (choose any)</legend>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const active = selectedTopics.includes(topic.id);
              return (
                <label
                  key={topic.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-lg font-medium transition",
                    active
                      ? "border-brand bg-seaglass/25 text-ocean"
                      : "border-2 border-seaglass bg-white/60 backdrop-blur text-ink hover:border-brand",
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
          <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
            {error}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="rounded-lg bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean">
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

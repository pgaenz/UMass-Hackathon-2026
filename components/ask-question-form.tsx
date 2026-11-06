"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MAX_QUESTION_LENGTH } from "@/lib/question-rules";
import type { Topic } from "@/lib/types";

interface SimilarItem {
  id: string;
  text: string;
  topics: string[];
  answerCount: number;
}

export function AskQuestionForm({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  function toggleTopic(topicId: string) {
    setSelectedTopics((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId],
    );
  }

  useEffect(() => {
    const query = text.trim();
    if (query.length < 15) {
      setSimilar([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/questions/similar?text=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { questions?: SimilarItem[] };
        setSimilar(Array.isArray(data.questions) ? data.questions.slice(0, 3) : []);
      } catch {
        // Similar questions are a hint, never a blocker.
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, topicIds: selectedTopics }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        notice?: string;
        question?: { id?: string };
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not post your question.");

      const notice =
        data?.notice ??
        "Your question is posted. Rivers can see it on Answer a question.";
      const id = data?.question?.id;
      const params = new URLSearchParams({ notice });
      if (id) params.set("highlight", id);
      router.push(`/questions/mine?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      window.setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="ask-question-heading"
      data-tour="ask-form"
      className="rounded-2xl glass shadow-water p-6 shadow-sm"
    >
      <h1 id="ask-question-heading" className="text-3xl font-bold tracking-tight text-ink">
        Ask a question
      </h1>
      <p className="mt-2 text-lg text-ink/70">
        Ask something you would really like an older person&apos;s experience of. Rivers
        will see it on Answer a question.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="space-y-2">
          <label htmlFor="question-text" className="text-lg font-semibold text-ink">
            Your question
          </label>
          <textarea
            id="question-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder="What was your first job, and how did you get it?"
            aria-describedby="question-hint question-count"
            className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          />
          <div className="flex flex-wrap justify-between gap-2 text-base text-ink/70">
            <p id="question-hint">Write it as you would say it aloud.</p>
            <p
              id="question-count"
              aria-live={text.length >= 280 ? "polite" : "off"}
              className={cn(text.length >= 280 && "font-semibold text-ocean")}
            >
              {text.length} of {MAX_QUESTION_LENGTH}
            </p>
          </div>
        </div>

        {similar.length > 0 ? (
          <section aria-labelledby="similar-heading" className="rounded-xl bg-seaglass/25 p-4">
            <h2 id="similar-heading" className="text-lg font-semibold text-ink">
              Someone may already have asked this
            </h2>
            <p className="mt-1 text-base text-ink/70">
              If one of these answers your question, you can read it.
            </p>
            <ul className="mt-3 space-y-2">
              {similar.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/questions/${item.id}`}
                    className="font-medium text-brand underline-offset-4 hover:underline"
                  >
                    {item.text}
                  </Link>
                  <span className="ml-2 text-sm text-ink/70">
                    {item.answerCount === 0
                      ? "No answers yet"
                      : `${item.answerCount} ${
                          item.answerCount === 1 ? "answer" : "answers"
                        }`}
                    {item.topics.length > 0 ? ` · ${item.topics.join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-ink">Topics (choose any)</legend>
          <p className="text-base text-ink/70">Topics help Rivers find your question.</p>
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
                      : "border-2 border-seaglass bg-white/60 text-ink backdrop-blur hover:border-brand",
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
          <p
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean outline-none"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Posting…" : "Post my question"}
        </Button>
      </form>
    </section>
  );
}

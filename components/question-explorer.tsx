"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { UpvoteButton } from "@/components/upvote-button";
import { WaterLines } from "@/components/water-lines";
import { cn } from "@/lib/cn";
import type { AuthorRef, Question, Topic } from "@/lib/types";

const TOPIC_ICONS: Record<string, string> = {
  job: "💼",
  "love-life": "❤️",
  family: "👪",
  childhood: "🎒",
  advice: "💡",
  friendship: "🤝",
  travel: "✈️",
  money: "💰",
  hobbies: "🎨",
  health: "🌿",
};

const TOPIC_BADGES: Record<string, string> = {
  job: "bg-brand/15 text-ocean",
  "love-life": "bg-brand/15 text-ocean",
  family: "bg-brand/15 text-ocean",
  childhood: "bg-brand/15 text-ocean",
  advice: "bg-brand/15 text-ocean",
  friendship: "bg-brand/15 text-ocean",
  travel: "bg-brand/15 text-ocean",
  money: "bg-brand/15 text-ocean",
  hobbies: "bg-brand/15 text-ocean",
  health: "bg-brand/15 text-ocean",
};

type Sort = "top" | "new" | "insightful" | "unanswered";

const QUICK_FILTERS: Array<{ id: Sort; icon: string; label: string }> = [
  { id: "top", icon: "🔥", label: "Trending Today" },
  { id: "insightful", icon: "💡", label: "Most Insightful" },
  { id: "new", icon: "✨", label: "Newest" },
  { id: "unanswered", icon: "❓", label: "Needs an answer" },
];

const QUICK_LINKS = [
  { icon: "🔥", label: "Popular questions", href: "/questions?sort=popular" },
  { icon: "❓", label: "Unanswered", href: "/questions?sort=unanswered" },
  { icon: "💬", label: "Recent answers", href: "/youth" },
  { icon: "👤", label: "Your profile", href: "/profile" },
];

interface QuestionExplorerProps {
  topics: Topic[];
  questions: Question[];
  answerCounts: Record<string, number>;
  authors: Record<string, AuthorRef>;
  canAnswer: boolean;
}

export function QuestionExplorer({
  topics,
  questions,
  answerCounts,
  authors,
  canAnswer,
}: QuestionExplorerProps) {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("top");

  const topicCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const topic of topics) {
      result[topic.id] = 0;
    }
    for (const question of questions) {
      for (const topicId of question.topicIds) {
        if (topicId in result) {
          result[topicId] += 1;
        }
      }
    }
    return result;
  }, [questions, topics]);

  const visible = useMemo(() => {
    const base = activeTopic
      ? questions.filter((question) => question.topicIds.includes(activeTopic))
      : [...questions];
    const filtered =
      sort === "unanswered"
        ? base.filter((question) => (answerCounts[question.id] ?? 0) === 0)
        : base;
    return [...filtered].sort((a, b) => {
      if (sort === "new") {
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }
      if (sort === "insightful") {
        return (
          (answerCounts[b.id] ?? 0) - (answerCounts[a.id] ?? 0) || b.upvotes - a.upvotes
        );
      }
      return b.upvotes - a.upvotes;
    });
  }, [questions, activeTopic, sort, answerCounts]);

  const topUpvotes = useMemo(
    () => visible.reduce((max, question) => Math.max(max, question.upvotes), 0),
    [visible],
  );

  return (
    <div className="grid flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
      {/* Left sidebar — topic filters */}
      <aside className="h-fit rounded-2xl glass shadow-water p-3 lg:sticky lg:top-24">
        <h2 className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-ink/70">
          Topics
        </h2>
        <ul className="mt-2 space-y-0.5">
          <li>
            <button
              type="button"
              aria-pressed={activeTopic === null}
              onClick={() => setActiveTopic(null)}
              className={filterClass(activeTopic === null)}
            >
              <span aria-hidden="true">🗂️</span>
              <span className="flex-1 text-left">All topics</span>
              <span className="text-xs font-semibold text-ink/70">{questions.length}</span>
            </button>
          </li>
          {topics.map((topic) => {
            const active = activeTopic === topic.id;
            return (
              <li key={topic.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveTopic(topic.id)}
                  className={filterClass(active)}
                >
                  <span aria-hidden="true">{TOPIC_ICONS[topic.id] ?? "📁"}</span>
                  <span className="flex-1 text-left">{topic.label}</span>
                  <span className="text-xs font-semibold text-ink/70">
                    {topicCounts[topic.id] ?? 0}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main column — hero + question feed */}
      <div className="min-w-0 space-y-6">
        <Hero canAnswer={canAnswer} />

        <section aria-labelledby="feed-heading" className="space-y-4">
          <div>
            <h1 id="feed-heading" className="text-2xl font-bold text-ink">
              Questions from the community
            </h1>
            <p className="text-sm text-ink/70">
              {visible.length} question{visible.length === 1 ? "" : "s"}
              {activeTopic
                ? ` in ${topics.find((topic) => topic.id === activeTopic)?.label ?? activeTopic}`
                : ""}
            </p>
          </div>

          {/* Sort control, left-aligned above the feed */}
          <label className="flex w-fit items-center gap-2 text-sm font-medium text-ink/80">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="h-11 rounded-xl glass px-3 text-sm font-medium text-ink focus:border-brand focus:outline-none"
            >
              <option value="top">Top voted</option>
              <option value="insightful">Most insightful</option>
              <option value="new">Newest</option>
              <option value="unanswered">Unanswered</option>
            </select>
          </label>

          {/* Horizontal quick filters, directly above the feed */}
          <div role="group" aria-label="Quick filters" className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((filter) => {
              const active = sort === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSort(filter.id)}
                  className={cn(
                    "ripple inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
                    active
                      ? "bg-sunset text-ocean shadow-water"
                      : "border border-seaglass bg-white/60 text-ink backdrop-blur hover:border-brand hover:bg-white/80",
                  )}
                >
                  <span aria-hidden="true">{filter.icon}</span>
                  {filter.label}
                </button>
              );
            })}
          </div>

          <ul className="space-y-4">
            {visible.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                topics={topics}
                answerCount={answerCounts[question.id] ?? 0}
                author={question.askedBy ? authors[question.askedBy] ?? null : null}
                highlight={sort === "top" && topUpvotes > 0 && question.upvotes === topUpvotes}
              />
            ))}
            {visible.length === 0 && (
              <li className="rounded-2xl glass border-2 border-dashed border-seaglass/70 p-8 text-center text-ink/70">
                No questions match this filter yet.
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* Right sidebar — community + quick links */}
      <aside className="h-fit space-y-6 lg:sticky lg:top-24">
        {canAnswer ? (
          <section className="rounded-2xl glass shadow-water p-5">
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl bg-brand text-2xl"
                aria-hidden="true"
              >
                🤝
              </span>
              <h2 className="font-semibold text-ink">Share what you know</h2>
            </div>
            <p className="mt-3 text-sm text-ink/70">
              Your experience is someone&apos;s answer. Add your voice to the community.
            </p>
            <Link
              href="/senior"
              className="ripple mt-4 inline-flex text-sm font-semibold text-brand hover:underline"
            >
              Start answering →
            </Link>
          </section>
        ) : null}

        <nav aria-label="Quick links" className="rounded-2xl glass shadow-water p-3">
          <h2 className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-ink/70">
            Quick links
          </h2>
          <ul className="mt-2 space-y-0.5">
            {QUICK_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="ripple flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink transition hover:bg-white/70"
                >
                  <span aria-hidden="true">{link.icon}</span>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}

function filterClass(active: boolean): string {
  return [
    "ripple flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
    active
      ? "bg-brand font-semibold text-white shadow-water"
      : "font-medium text-ink hover:bg-white/70",
  ].join(" ");
}

function QuestionRow({
  question,
  topics,
  answerCount,
  author,
  highlight,
}: {
  question: Question;
  topics: Topic[];
  answerCount: number;
  author: AuthorRef | null;
  highlight: boolean;
}) {
  return (
    <li
      className={cn(
        "lift flex gap-4 rounded-2xl glass shadow-water p-4 sm:gap-6 sm:p-5",
        highlight && "ring-2 ring-sunset/60",
      )}
    >
      <UpvoteButton questionId={question.id} initialCount={question.upvotes} />

      <div className="min-w-0 flex-1">
        <Link
          href={`/questions/${question.id}`}
          className="text-lg font-semibold leading-snug text-ink underline-offset-4 hover:text-brand hover:underline sm:text-xl"
        >
          {question.text}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {highlight ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sunset/25 px-2.5 py-0.5 text-xs font-bold text-ocean">
              <span aria-hidden="true">★</span> Top voted
            </span>
          ) : null}
          {question.topicIds.map((topicId) => {
            const topic = topics.find((candidate) => candidate.id === topicId);
            return (
              <span
                key={topicId}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  TOPIC_BADGES[topicId] ?? "bg-brand/15 text-ocean"
                }`}
              >
                {TOPIC_ICONS[topicId] ?? "📁"} {topic?.label ?? topicId}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-right">
        <span className="rounded-full bg-seaglass/25 px-3 py-1 text-xs font-semibold text-ocean">
          {answerCount} {answerCount === 1 ? "answer" : "answers"}
        </span>
        {author ? (
          <Link
            href={`/profile/${author.id}`}
            className="text-xs font-medium text-brand hover:underline"
          >
            {author.name}
          </Link>
        ) : (
          <span className="text-xs text-ink/75">community</span>
        )}
        <span suppressHydrationWarning className="text-xs text-ink/75">
          {relativeTime(question.createdAt)}
        </span>
        <CopyButton text={question.text} context={question.text} compact />
      </div>
    </li>
  );
}

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function Hero({ canAnswer }: { canAnswer: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ocean text-white shadow-water-lg">
      <WaterLines />
      <div className="relative z-10 grid items-stretch gap-6 sm:grid-cols-2">
        <div className="space-y-4 p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-seaglass">
            HistorAI · When I was your age
          </span>
          <h2 className="text-3xl font-bold leading-tight text-white">
            Every question deserves a story only a lifetime can tell.
          </h2>
          <p className="text-white/80">
            Ask what you have always wondered, or share the answer only you can give.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/questions"
              className="ripple inline-flex min-h-11 items-center rounded-xl bg-sunset px-5 font-bold text-ocean shadow-water transition hover:brightness-105"
            >
              Ask a question
            </Link>
            {canAnswer ? (
              <Link
                href="/senior"
                className="ripple inline-flex min-h-11 items-center rounded-xl border border-seaglass/60 bg-transparent px-5 font-semibold text-white transition hover:bg-white/10"
              >
                Answer a question
              </Link>
            ) : null}
          </div>
        </div>
        <div className="relative min-h-56 sm:min-h-0">
          <Image
            src="/hero-ocean.png"
            alt="Hero"
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}

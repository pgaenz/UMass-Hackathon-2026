"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Image from "next/image";

import { UpvoteButton } from "@/components/upvote-button";
import type { Question, Topic } from "@/lib/types";

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
  job: "bg-sky-100 text-sky-700",
  "love-life": "bg-rose-100 text-rose-700",
  family: "bg-emerald-100 text-emerald-700",
  childhood: "bg-violet-100 text-violet-700",
  advice: "bg-amber-100 text-amber-700",
  friendship: "bg-teal-100 text-teal-700",
  travel: "bg-cyan-100 text-cyan-700",
  money: "bg-lime-100 text-lime-700",
  hobbies: "bg-fuchsia-100 text-fuchsia-700",
  health: "bg-green-100 text-green-700",
};

const QUICK_LINKS = [
  { icon: "🔥", label: "Popular questions", href: "/questions?sort=popular" },
  { icon: "❓", label: "Unanswered", href: "/questions?sort=unanswered" },
  { icon: "💬", label: "Recent answers", href: "/youth" },
  { icon: "👤", label: "Your profile", href: "#" },
];

interface QuestionExplorerProps {
  topics: Topic[];
  questions: Question[];
  answerCounts: Record<string, number>;
}

export function QuestionExplorer({ topics, questions, answerCounts }: QuestionExplorerProps) {
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [sort, setSort] = useState<"top" | "new">("top");

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
    const filtered = activeTopic
      ? questions.filter((question) => question.topicIds.includes(activeTopic))
      : questions;
    return [...filtered].sort((a, b) =>
      sort === "top" ? b.upvotes - a.upvotes : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }, [questions, activeTopic, sort]);

  return (
    <div className="grid flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        {/* Left sidebar — topic filters */}
        <aside className="h-fit rounded-2xl border border-orange-100 bg-surface p-3 shadow-sm lg:sticky lg:top-24">
          <h2 className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
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
                <span className="text-xs font-semibold text-gray-500">{questions.length}</span>
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
                    <span className="text-xs font-semibold text-gray-500">
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
          <Hero />

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-ink">Questions from the community</h1>
              <p className="text-sm text-gray-500">
                {visible.length} question{visible.length === 1 ? "" : "s"}
                {activeTopic
                  ? ` in ${topics.find((topic) => topic.id === activeTopic)?.label ?? activeTopic}`
                  : ""}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span>Sort by</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value === "new" ? "new" : "top")}
                className="h-10 rounded-xl border border-orange-100 bg-surface px-3 text-sm font-medium text-ink focus:border-brand focus:outline-none"
              >
                <option value="top">Top voted</option>
                <option value="new">Newest</option>
              </select>
            </label>
          </div>

          <ul className="space-y-4">
            {visible.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                topics={topics}
                answerCount={answerCounts[question.id] ?? 0}
              />
            ))}
            {visible.length === 0 && (
              <li className="rounded-2xl border border-dashed border-orange-200 bg-surface p-8 text-center text-gray-500">
                No questions in this topic yet.
              </li>
            )}
          </ul>
        </div>

        {/* Right sidebar — community + quick links */}
        <aside className="h-fit space-y-6 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
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
              className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline"
            >
              Start answering →
            </Link>
          </section>

          <nav
            aria-label="Quick links"
            className="rounded-2xl border border-orange-100 bg-surface p-3 shadow-sm"
          >
            <h2 className="px-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Quick links
            </h2>
            <ul className="mt-2 space-y-0.5">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink transition hover:bg-orange-50"
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
    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
    active ? "bg-orange-100 font-semibold text-brand" : "font-medium text-ink hover:bg-orange-50",
  ].join(" ");
}

function QuestionRow({
  question,
  topics,
  answerCount,
}: {
  question: Question;
  topics: Topic[];
  answerCount: number;
}) {
  return (
    <li className="flex gap-4 rounded-2xl border border-orange-100 bg-surface p-4 shadow-sm transition hover:shadow-md sm:gap-6 sm:p-5">
      <UpvoteButton questionId={question.id} initialCount={question.upvotes} />

      <div className="min-w-0 flex-1">
        <Link
          href={`/questions/${question.id}`}
          className="text-lg font-semibold leading-snug text-ink underline-offset-4 hover:text-brand hover:underline sm:text-xl"
        >
          {question.text}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {question.topicIds.map((topicId) => {
            const topic = topics.find((candidate) => candidate.id === topicId);
            return (
              <span
                key={topicId}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  TOPIC_BADGES[topicId] ?? "bg-orange-100 text-orange-700"
                }`}
              >
                {TOPIC_ICONS[topicId] ?? "📁"} {topic?.label ?? topicId}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2 text-right">
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-brand">
          {answerCount} {answerCount === 1 ? "answer" : "answers"}
        </span>
        <span suppressHydrationWarning className="text-xs text-gray-400">
          {relativeTime(question.createdAt)}
        </span>
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

function Hero() {
  return (
    <section className="overflow-hidden rounded-3xl bg-orange-100">
      <div className="grid items-stretch gap-6 sm:grid-cols-2">
        <div className="space-y-4 p-6 sm:p-8">
          <span className="inline-flex rounded-full bg-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            HistorAI
          </span>
          <h2 className="text-3xl font-bold leading-tight text-ink">
            Every question deserves a story only a lifetime can tell.
          </h2>
          <p className="text-ink/80">
            Ask what you have always wondered, or share the answer only you can give.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/questions"
              className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              Ask a question
            </Link>
            <Link
              href="/senior"
              className="inline-flex min-h-11 items-center rounded-xl border border-brand/40 bg-surface px-5 font-semibold text-brand transition hover:bg-orange-50"
            >
              Answer a question
            </Link>
          </div>
        </div>
        <div className="relative min-h-56 sm:min-h-0">
          <Image src="/hero.png" alt="Hero" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
        </div>
      </div>
    </section>
  );
}

// function HeroIllustration() {
//   return (
//     <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
//       <path
//         d="M40 140c-20-40 0-100 60-110 40-7 60 10 90 6 40-6 90 30 84 82-6 55-70 76-130 72C90 187 60 180 40 140Z"
//         fill="#FED7AA"
//         opacity="0.7"
//       />

//       {/* Older person */}
//       <circle cx="112" cy="78" r="24" fill="#FFFFFF" stroke="#C2410C" strokeWidth="3" />
//       <path d="M88 72c2-18 46-18 48 0" fill="#E5E7EB" stroke="#C2410C" strokeWidth="3" />
//       <circle cx="104" cy="80" r="2.5" fill="#C2410C" />
//       <circle cx="120" cy="80" r="2.5" fill="#C2410C" />
//       <path d="M104 90q8 6 16 0" fill="none" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" />
//       <rect x="84" y="104" width="56" height="66" rx="24" fill="#F97316" />

//       {/* Younger person */}
//       <circle cx="214" cy="86" r="22" fill="#FFFFFF" stroke="#B45309" strokeWidth="3" />
//       <path d="M194 80c4-16 36-16 40 0" fill="#7C2D12" stroke="#B45309" strokeWidth="3" />
//       <circle cx="207" cy="88" r="2.5" fill="#B45309" />
//       <circle cx="221" cy="88" r="2.5" fill="#B45309" />
//       <path d="M207 98q7 5 14 0" fill="none" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
//       <rect x="190" y="110" width="48" height="60" rx="22" fill="#F59E08" />

//       {/* Question bubble */}
//       <rect x="150" y="28" width="70" height="38" rx="14" fill="#FFFFFF" stroke="#F97316" strokeWidth="3" />
//       <path d="M168 66l-6 12 16-12" fill="#FFFFFF" stroke="#F97316" strokeWidth="3" strokeLinejoin="round" />
//       <circle cx="172" cy="47" r="3" fill="#F97316" />
//       <circle cx="185" cy="47" r="3" fill="#F97316" />
//       <circle cx="198" cy="47" r="3" fill="#F97316" />
//     </svg>
//   );
// }

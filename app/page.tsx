import Link from "next/link";

import { QuestionCard } from "@/components/question-card";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getQuestions, getTopics } from "@/lib/questions";

export const dynamic = "force-dynamic";

const entryPoints = [
  {
    href: "/questions",
    title: "Ask a question",
    description: "Post a question and add the topics it belongs to.",
    cta: "Ask a question",
  },
  {
    href: "/senior",
    title: "Answer a question",
    description: "Record or type an answer to a question a young person asked.",
    cta: "Share your answer",
  },
  {
    href: "/youth",
    title: "Read the stories",
    description: "Browse answers from seniors, turned into short, clear articles.",
    cta: "Read stories",
  },
];

export default async function HomePage() {
  const [questions, topics, stories] = await Promise.all([
    getQuestions(),
    getTopics(),
    getPublishedStories(),
  ]);
  const counts = countAnswersByQuestion(stories);
  const popular = questions.slice(0, 3);

  return (
    <div className="space-y-14">
      <section className="space-y-4">
        <p className="text-lg font-semibold uppercase tracking-wide text-sky-800">HistorAI</p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          When I was your age…
        </h1>
        <p className="max-w-3xl text-xl text-slate-600">
          A young person asks. A senior answers out loud. AI turns the answer into a story worth
          reading — with no invented facts.
        </p>
      </section>

      <section aria-labelledby="get-started">
        <h2 id="get-started" className="sr-only">
          Get started
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {entryPoints.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group flex flex-col rounded-2xl border-2 border-slate-200 bg-white p-7 shadow-sm transition hover:border-sky-700 hover:shadow-md"
            >
              <h3 className="text-2xl font-semibold text-slate-900">{entry.title}</h3>
              <p className="mt-3 flex-1 text-lg text-slate-600">{entry.description}</p>
              <span className="mt-5 text-lg font-semibold text-sky-800 underline-offset-4 group-hover:underline">
                {entry.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="popular-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="popular-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            Popular questions
          </h2>
          <Link href="/questions" className="text-lg font-semibold text-sky-800 hover:underline">
            See all questions →
          </Link>
        </div>
        <ul className="space-y-4">
          {popular.map((question) => (
            <li key={question.id}>
              <QuestionCard
                question={question}
                topics={topics}
                answerCount={counts[question.id] ?? 0}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

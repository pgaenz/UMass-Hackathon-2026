import type { Metadata } from "next";
import Link from "next/link";

import { AnswerForm } from "@/components/answer-form";
import { QuestionFilterBar } from "@/components/filter-bar";
import { QuestionCard } from "@/components/question-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getVoteStates } from "@/lib/question-votes";
import { getQuestions, getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Answer a question",
};

type Sort = "popular" | "newest" | "unanswered";

export default async function SeniorPage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string; topic?: string; sort?: string }>;
}) {
  const { question: questionId, topic, sort: rawSort } = await searchParams;
  const [questions, topics, stories] = await Promise.all([
    getQuestions(),
    getTopics(),
    getPublishedStories(),
  ]);
  const counts = countAnswersByQuestion(stories);
  const selected = questionId ? (questions.find((question) => question.id === questionId) ?? null) : null;

  if (questionId && !selected) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
        <PageHeader title="Answer a question" description="We could not find that question." />
        <ButtonLink href="/senior">Choose another question</ButtonLink>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
        <Link href="/senior" className="text-lg font-semibold text-brand hover:underline">
          ← Choose a different question
        </Link>

        <PageHeader title="Answer this question" />

        <div className="rounded-2xl border-l-4 border-brand bg-seaglass/25 p-6">
          <p className="text-2xl font-semibold leading-snug text-ink">{selected.text}</p>
        </div>

        <AnswerForm questionId={selected.id} questionText={selected.text} />
      </div>
    );
  }

  const sort: Sort =
    rawSort === "newest" || rawSort === "unanswered" ? rawSort : "popular";
  const sorted = topic
    ? questions.filter((question) => question.topicIds.includes(topic))
    : [...questions];

  let list = sorted;
  if (sort === "newest") {
    list = [...sorted].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else if (sort === "unanswered") {
    list = sorted.filter((question) => (counts[question.id] ?? 0) === 0);
  } else {
    list = [...sorted].sort((a, b) => b.upvotes - a.upvotes);
  }

  const user = await getCurrentUser();
  const voteStates = await getVoteStates(
    list.map((question) => question.id),
    user?.id ?? null,
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <PageHeader
        title="Answer a question"
        description="Browse every question from young people, filter by topic, and choose one to answer."
      />

      <QuestionFilterBar
        topics={topics}
        activeTopic={topic}
        activeSort={sort}
        basePath="/senior"
      />

      {list.length > 0 ? (
        <ul className="space-y-4" data-tour="senior-questions">
          {list.map((question) => (
            <li key={question.id}>
              <QuestionCard
                question={question}
                topics={topics}
                answerCount={counts[question.id] ?? 0}
                href={`/senior?question=${question.id}`}
                voteState={voteStates[question.id]}
                signedIn={Boolean(user)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={
            sort === "unanswered"
              ? "No unanswered questions in this topic"
              : "No questions match these filters"
          }
          description="Try another topic, or switch the filter back to all questions."
        >
          <ButtonLink href="/senior" variant="secondary">
            Clear filters
          </ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}

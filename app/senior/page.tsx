import type { Metadata } from "next";
import Link from "next/link";

import { AnswerForm } from "@/components/answer-form";
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

export default async function SeniorPage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>;
}) {
  const { question: questionId } = await searchParams;
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

  const unanswered = questions.filter((question) => (counts[question.id] ?? 0) === 0);
  const suggestions = (unanswered.length > 0 ? unanswered : questions).slice(0, 6);
  const user = await getCurrentUser();
  const voteStates = await getVoteStates(
    suggestions.map((question) => question.id),
    user?.id ?? null,
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <PageHeader
        title="Answer a question"
        description="Pick a question a young person asked, then record or type your answer."
      />

      {suggestions.length > 0 ? (
        <ul className="space-y-4" data-tour="senior-questions">
          {suggestions.map((question) => (
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
          title="No questions to answer yet"
          description="Check back soon, or read stories other seniors have shared."
        >
          <ButtonLink href="/youth">Read stories</ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}

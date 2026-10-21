import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleRenderer } from "@/components/article-renderer";
import { ReportButton } from "@/components/report-button";
import { UpvoteButton } from "@/components/upvote-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublishedStories } from "@/lib/answers";
import { formatDate, truncate } from "@/lib/format";
import { getQuestion, getTopics } from "@/lib/questions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const question = await getQuestion(id);
  return { title: question ? truncate(question.text) : "Question" };
}

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [question, topics, stories] = await Promise.all([
    getQuestion(id),
    getTopics(),
    getPublishedStories(),
  ]);
  if (!question) notFound();

  const answers = stories.filter((story) => story.questionId === question.id);
  const labels = question.topicIds
    .map((topicId) => topics.find((topic) => topic.id === topicId)?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <article className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <Link href="/questions" className="text-lg font-semibold text-brand hover:underline">
        ← All questions
      </Link>

      <header className="space-y-5">
        <div className="flex gap-4 sm:gap-6">
          <UpvoteButton questionId={question.id} initialCount={question.upvotes} />
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="text-3xl font-bold leading-snug tracking-tight text-ink sm:text-4xl">
              {question.text}
            </h1>
            {labels.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label="Topics">
                {labels.map((label) => (
                  <li key={label}>
                    <Badge>{label}</Badge>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-ink/70">
              <span>{answers.length === 1 ? "1 answer" : `${answers.length} answers`}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
              <ReportButton targetType="question" targetId={question.id} />
            </div>
          </div>
        </div>

        <ButtonLink href={`/senior?question=${question.id}`} size="lg">
          Answer this question
        </ButtonLink>
      </header>

      <section aria-labelledby="answers-heading" className="space-y-5">
        <h2 id="answers-heading" className="text-2xl font-bold tracking-tight text-ink">
          {answers.length === 1 ? "1 answer" : `${answers.length} answers`}
        </h2>

        {answers.length > 0 ? (
          <ul className="space-y-5">
            {answers.map((answer) => (
              <li key={answer.id}>
                <article className="rounded-2xl border border-orange-100 bg-surface p-6 shadow-sm">
                  <ArticleRenderer markdown={answer.article} />
                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-orange-100 pt-4 text-base text-gray-500">
                    <time dateTime={answer.createdAt}>{formatDate(answer.createdAt)}</time>
                    <ReportButton targetType="answer" targetId={answer.id} />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No answers yet"
            description="Be the first to answer this question from a senior's point of view."
          >
            <ButtonLink href={`/senior?question=${question.id}`}>Answer this question</ButtonLink>
          </EmptyState>
        )}
      </section>
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleRenderer } from "@/components/article-renderer";
import { AnswerSortBar } from "@/components/answer-sort-bar";
import { MessageButton } from "@/components/chat/message-button";
import { CopyButton } from "@/components/copy-button";
import { LikeButton } from "@/components/like-button";
import { ReportButton } from "@/components/report-button";
import { ShareButton } from "@/components/share-button";
import { UpvoteButton } from "@/components/upvote-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublishedStories } from "@/lib/answers";
import { canSendTo } from "@/lib/chat";
import { firstName, formatDate, toPlainText, truncate } from "@/lib/format";
import { getLikeStates } from "@/lib/likes";
import { getVoteStates } from "@/lib/question-votes";
import { getQuestion, getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import { getPublicUserMap, getUser, toPublicUser } from "@/lib/users";

export const dynamic = "force-dynamic";

type Sort = "newest" | "likes";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const { sort: rawSort } = await searchParams;
  const [question, topics, stories] = await Promise.all([
    getQuestion(id),
    getTopics(),
    getPublishedStories(),
  ]);
  if (!question) notFound();

  const [asker, user] = await Promise.all([
    question.askedBy ? getUser(question.askedBy) : Promise.resolve(null),
    getCurrentUser(),
  ]);
  const askerRef = asker ? toPublicUser(asker) : null;
  const canAnswer = user?.role === "river";
  const voteState = (await getVoteStates([question.id], user?.id ?? null))[question.id];

  const answers = stories.filter((story) => story.questionId === question.id);
  const answerLikeStates = await getLikeStates(
    answers.map((answer) => answer.id),
    user?.id ?? null,
  );
  const sort: Sort = rawSort === "likes" ? "likes" : "newest";
  const orderedAnswers = [...answers].sort((a, b) => {
    if (sort === "likes") {
      const diff =
        (answerLikeStates[b.id]?.count ?? 0) - (answerLikeStates[a.id]?.count ?? 0);
      if (diff !== 0) return diff;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
  const answerAuthors = await getPublicUserMap(
    orderedAnswers.map((answer) => answer.authorId),
  );
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
          <UpvoteButton
            questionId={question.id}
            initialCount={question.upvotes}
            initialVoted={voteState?.voted ?? false}
            signedIn={Boolean(user)}
          />
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
              {askerRef ? (
                <Link href={`/profile/${askerRef.id}`} className="font-medium text-brand hover:underline">
                  asked by {askerRef.name}
                </Link>
              ) : (
                <span>Asked by the community</span>
              )}
              {asker && canSendTo(user, asker) ? (
                <MessageButton
                  participantId={asker.id}
                  label={`Ask ${firstName(asker.name)} a Question?`}
                  variant="secondary"
                />
              ) : null}
              <div className="flex items-center">
                <CopyButton text={question.text} context={question.text} />
                <ShareButton
                  path={`/questions/${question.id}`}
                  title={question.text}
                  context={question.text}
                />
                <ReportButton targetType="question" targetId={question.id} />
              </div>
            </div>
          </div>
        </div>

        {canAnswer ? (
          <ButtonLink href={`/senior?question=${question.id}`} size="lg">
            Answer this question
          </ButtonLink>
        ) : null}
      </header>

      <section aria-labelledby="answers-heading" className="space-y-5">
        <h2 id="answers-heading" className="text-2xl font-bold tracking-tight text-ink">
          {answers.length === 1 ? "1 answer" : `${answers.length} answers`}
        </h2>

        {answers.length > 1 ? (
          <AnswerSortBar
            topics={[]}
            activeSort={sort}
            basePath={`/questions/${question.id}`}
          />
        ) : null}

        {answers.length > 0 ? (
          <ul className="space-y-5">
            {orderedAnswers.map((answer) => {
              const answerAuthor = answer.authorId
                ? answerAuthors[answer.authorId] ?? null
                : null;
              return (
                <li key={answer.id}>
                  <article className="rounded-2xl glass shadow-water p-6 shadow-sm">
                    <ArticleRenderer markdown={answer.article} />
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-seaglass/40 pt-4 text-base text-ink/70">
                      {answerAuthor ? (
                        <Link
                          href={`/profile/${answerAuthor.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          by {answerAuthor.name}
                        </Link>
                      ) : (
                        <span>HistorAI community</span>
                      )}
                      <time dateTime={answer.createdAt}>{formatDate(answer.createdAt)}</time>
                      {answer.article.trim() ? (
                        <CopyButton text={toPlainText(answer.article)} />
                      ) : null}
                      {answerAuthor && canSendTo(user, answerAuthor) ? (
                        <MessageButton
                          participantId={answerAuthor.id}
                          label={`Ask ${firstName(answerAuthor.name)} a Question?`}
                          variant="secondary"
                        />
                      ) : null}
                      <LikeButton
                        storyId={answer.id}
                        initialLiked={answerLikeStates[answer.id]?.liked ?? false}
                        initialCount={answerLikeStates[answer.id]?.count ?? 0}
                        signedIn={Boolean(user)}
                      />
                      <ReportButton targetType="answer" targetId={answer.id} />
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No answers yet"
            description="Be the first to answer this question from a River's point of view."
          >
            {canAnswer ? (
              <ButtonLink href={`/senior?question=${question.id}`}>Answer this question</ButtonLink>
            ) : null}
          </EmptyState>
        )}
      </section>
    </article>
  );
}

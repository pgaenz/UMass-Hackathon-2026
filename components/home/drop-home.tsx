import Link from "next/link";

import { HomeHero, HomeQuestionList, HomeStoryList } from "@/components/home/shared";
import type { HomeData } from "@/components/home/shared";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { deriveDropQuestionState } from "@/lib/drop-question-state";
import { formatDate } from "@/lib/format";

/**
 * Drop home: lead with asking a question, then show what happened to the
 * Drop's own questions, then stories and popular questions.
 */
export function DropHome({
  data,
  userName,
  userId,
}: {
  data: HomeData;
  userName: string;
  userId: string;
}) {
  const stories = data.stories.slice(0, 3);
  const questions = [...data.questions].sort((a, b) => b.upvotes - a.upvotes).slice(0, 3);
  const myQuestions = data.questions
    .filter((question) => question.askedBy === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <HomeHero
        eyebrow={`Welcome back, ${userName}`}
        title="What would you like to learn from someone who's been there?"
        description="Ask a question in your own words, or read stories that already answer questions like yours."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/questions/new" size="lg">
            Ask a question
          </ButtonLink>
          <ButtonLink href="/questions" variant="secondary" size="lg" className="text-white">
            Browse questions
          </ButtonLink>
        </div>
      </HomeHero>

      <section aria-labelledby="your-questions-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="your-questions-heading" className="text-2xl font-bold tracking-tight text-ink">
            Your questions
          </h2>
          {myQuestions.length > 0 ? (
            <Link
              href="/questions/mine"
              className="text-base font-semibold text-brand underline-offset-4 hover:underline"
            >
              See all my questions →
            </Link>
          ) : null}
        </div>

        {myQuestions.length > 0 ? (
          <ul className="space-y-3">
            {myQuestions.map((question) => {
              const state = deriveDropQuestionState(question, data.allStories);
              return (
                <li
                  key={question.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl glass shadow-water p-5 shadow-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={`/questions/${question.id}`}
                      className="text-lg font-semibold text-ink underline-offset-4 hover:underline"
                    >
                      {question.text}
                    </Link>
                    <p className="text-base text-ink/70">
                      {state.label} · {formatDate(question.updatedAt ?? question.createdAt)}
                    </p>
                  </div>
                  {state.id === "answered" && state.storyId ? (
                    <ButtonLink href={`/youth/${state.storyId}`} variant="secondary">
                      Read the story
                    </ButtonLink>
                  ) : state.id === "waiting" ? (
                    <ButtonLink
                      href="/questions?sort=unanswered"
                      variant="secondary"
                    >
                      See similar questions
                    </ButtonLink>
                  ) : (
                    <Badge>{state.label}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-seaglass/40 bg-seaglass/25 p-6">
            <p className="text-lg text-ink/80">
              You have not asked a question yet. Ask something you would really like an
              older person&apos;s experience of.
            </p>
            <ButtonLink href="/questions/new" className="mt-4">
              Ask a question
            </ButtonLink>
          </div>
        )}
      </section>

      <section aria-labelledby="drop-stories-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="drop-stories-heading" className="text-2xl font-bold tracking-tight text-ink">
              Stories that answer real questions
            </h2>
            <p className="mt-1 text-lg text-ink/70">
              Each story was written by an older adult from their own experience.
            </p>
          </div>
          <Link
            href="/youth"
            className="text-base font-semibold text-brand underline-offset-4 hover:underline"
          >
            Read all stories →
          </Link>
        </div>

        {stories.length > 0 ? (
          <HomeStoryList data={data} stories={stories} />
        ) : (
          <EmptyState
            title="No stories yet"
            description="Stories will appear here once a River reviews and publishes one. You can still ask a question."
          >
            <ButtonLink href="/questions/new">Ask a question</ButtonLink>
          </EmptyState>
        )}
      </section>

      {questions.length > 0 ? (
        <section aria-labelledby="drop-questions-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="drop-questions-heading" className="text-2xl font-bold tracking-tight text-ink">
                Popular questions
              </h2>
              <p className="mt-1 text-lg text-ink/70">
                Upvoted most by others. Read the answers, or ask something similar.
              </p>
            </div>
            <Link
              href="/questions"
              className="text-base font-semibold text-brand underline-offset-4 hover:underline"
            >
              Browse all questions →
            </Link>
          </div>
          <HomeQuestionList data={data} questions={questions} />
        </section>
      ) : null}
    </div>
  );
}

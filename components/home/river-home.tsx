import Link from "next/link";

import { HomeHero, HomeQuestionList, HomeStoryList, ProcessSteps } from "@/components/home/shared";
import type { HomeData } from "@/components/home/shared";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * River home: lead with the one useful action (answer a question), show what is
 * still unanswered, and explain the answer → review → publish path. Reading
 * published stories stays available as a secondary action.
 */
export function RiverHome({ data, userName }: { data: HomeData; userName: string }) {
  const unanswered = data.questions
    .filter((question) => (data.answerCounts[question.id] ?? 0) === 0)
    .sort((a, b) => b.upvotes - a.upvotes);
  const recent = [...data.questions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  // Never leave the River at a dead end: fall back to recent questions.
  const questions = unanswered.length > 0 ? unanswered.slice(0, 5) : recent;
  const stories = data.stories.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <HomeHero
        eyebrow={`Welcome back, ${userName}`}
        title="Your experience can help answer someone's question."
        description="Pick a question you have lived through, answer in your own words, and decide whether to share it as a story."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/senior" size="lg">
            Find a question to answer
          </ButtonLink>
          <ButtonLink href="/youth" variant="secondary" size="lg" className="text-white">
            Read stories
          </ButtonLink>
        </div>
        <ProcessSteps
          steps={["Answer", "Review your story", "Choose whether to publish"]}
        />
      </HomeHero>

      <section aria-labelledby="river-questions-heading" className="space-y-5">
        <div>
          <h2 id="river-questions-heading" className="text-2xl font-bold tracking-tight text-ink">
            {unanswered.length > 0 ? "Questions that still need an answer" : "Recent questions"}
          </h2>
          <p className="mt-1 text-lg text-ink/70">
            {unanswered.length > 0
              ? "These questions have no published answer yet. Choose one you have personal experience with."
              : "Every question has a published answer so far. Here are the newest ones if you would like to add your perspective."}
          </p>
        </div>

        {questions.length > 0 ? (
          <>
            <HomeQuestionList
              data={data}
              questions={questions}
              action={(question) => (
                <ButtonLink href={`/senior?question=${question.id}`}>
                  Answer this question
                </ButtonLink>
              )}
            />
            <Link
              href="/senior"
              className="inline-flex text-base font-semibold text-brand underline-offset-4 hover:underline"
            >
              See all questions →
            </Link>
          </>
        ) : (
          <EmptyState
            title="No questions yet"
            description="When someone asks a question, it will appear here for you to answer."
          >
            <ButtonLink href="/youth" variant="secondary">
              Read stories instead
            </ButtonLink>
          </EmptyState>
        )}
      </section>

      {stories.length > 0 ? (
        <section aria-labelledby="river-stories-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="river-stories-heading" className="text-2xl font-bold tracking-tight text-ink">
              Stories from other Rivers
            </h2>
            <Link
              href="/youth"
              className="text-base font-semibold text-brand underline-offset-4 hover:underline"
            >
              Read all stories →
            </Link>
          </div>
          <HomeStoryList data={data} stories={stories} />
        </section>
      ) : null}
    </div>
  );
}

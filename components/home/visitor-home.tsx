import Link from "next/link";

import { HomeHero, HomeQuestionList, HomeStoryList } from "@/components/home/shared";
import type { HomeData } from "@/components/home/shared";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Visitor home: a neutral welcome that prioritizes reading. Signing in is
 * offered but never required to browse questions and stories.
 */
export function VisitorHome({ data }: { data: HomeData }) {
  const stories = data.stories.slice(0, 3);
  const questions = [...data.questions].sort((a, b) => b.upvotes - a.upvotes).slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <HomeHero
        eyebrow="HistorAI · When I was your age"
        title="Every question deserves a story only a lifetime can tell."
        description="Read real questions from young people and the stories older adults share in answer. No profile needed."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/youth" size="lg">
            Read stories
          </ButtonLink>
          <ButtonLink href="/questions" variant="secondary" size="lg" className="text-white">
            Browse questions
          </ButtonLink>
        </div>
      </HomeHero>

      <p className="rounded-2xl border border-seaglass/40 bg-seaglass/25 px-5 py-4 text-lg text-ink/80">
        You can read everything without signing in. To ask a question or answer one, create a
        free profile — it takes a moment and needs no password.{" "}
        <Link
          href="/login"
          className="font-semibold text-brand underline-offset-4 hover:underline"
        >
          Create a profile
        </Link>
      </p>

      <section aria-labelledby="visitor-stories-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="visitor-stories-heading" className="text-2xl font-bold tracking-tight text-ink">
            Stories to start with
          </h2>
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
            description="Published stories will appear here. In the meantime, you can browse the questions."
          >
            <ButtonLink href="/questions">Browse questions</ButtonLink>
          </EmptyState>
        )}
      </section>

      {questions.length > 0 ? (
        <section aria-labelledby="visitor-questions-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="visitor-questions-heading" className="text-2xl font-bold tracking-tight text-ink">
              Questions people are asking
            </h2>
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

import type { ReactNode } from "react";

import { QuestionCard } from "@/components/question-card";
import { StoryCard } from "@/components/story-card";
import { WaterLines } from "@/components/water-lines";
import type {
  AuthorRef,
  Question,
  QuestionVoteState,
  Story,
  StoryLikeState,
  Topic,
} from "@/lib/types";

/**
 * Serializable data every role home needs. Assembled once on the server in
 * `app/page.tsx` and passed to the River, Drop, or visitor composition so the
 * three views share one data shape and the same card components.
 */
export interface HomeData {
  topics: Topic[];
  questions: Question[];
  stories: Story[];
  /** Every story, including drafts, so Drop question states can be derived. */
  allStories: Story[];
  answerCounts: Record<string, number>;
  authors: Record<string, AuthorRef>;
  voteStates: Record<string, QuestionVoteState>;
  likeStates: Record<string, StoryLikeState>;
  questionMap: Record<string, Question>;
  signedIn: boolean;
}

/** Shared hero shell: ocean backdrop, one plain-language lead, and a CTA slot. */
export function HomeHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ocean text-white shadow-water-lg">
      <WaterLines />
      <div className="relative z-10 space-y-4 p-6 sm:p-8">
        <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-seaglass">
          {eyebrow}
        </span>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-lg text-white/85">{description}</p>
        {children}
      </div>
    </section>
  );
}

/** The River's publication path, shown once near the primary action. */
export function ProcessSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-base text-white/85">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 place-items-center rounded-full bg-sunset text-sm font-bold text-ocean"
          >
            {index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

/** A question list that reuses the shared QuestionCard, with an optional action. */
export function HomeQuestionList({
  data,
  questions,
  action,
}: {
  data: HomeData;
  questions: Question[];
  action?: (question: Question) => ReactNode;
}) {
  return (
    <ul className="space-y-4">
      {questions.map((question) => (
        <li key={question.id}>
          <QuestionCard
            question={question}
            topics={data.topics}
            answerCount={data.answerCounts[question.id] ?? 0}
            author={question.askedBy ? data.authors[question.askedBy] ?? null : null}
            voteState={data.voteStates[question.id]}
            signedIn={data.signedIn}
            action={action ? action(question) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

/** A story list that reuses the shared StoryCard, keeping each story with its question. */
export function HomeStoryList({ data, stories }: { data: HomeData; stories: Story[] }) {
  return (
    <ul className="space-y-5">
      {stories.map((story) => {
        const question = story.questionId ? data.questionMap[story.questionId] ?? null : null;
        return (
          <li key={story.id}>
            <StoryCard
              story={story}
              author={story.authorId ? data.authors[story.authorId] ?? null : null}
              likeState={data.likeStates[story.id] ?? { liked: false, count: 0 }}
              signedIn={data.signedIn}
              question={question ? { id: question.id, text: question.text } : null}
            />
          </li>
        );
      })}
    </ul>
  );
}

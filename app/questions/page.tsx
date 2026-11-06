import type { Metadata } from "next";

import { QuestionFilterBar } from "@/components/filter-bar";
import { QuestionCard } from "@/components/question-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getVoteStates } from "@/lib/question-votes";
import { getQuestions, getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import { getPublicUserMap } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Questions",
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; sort?: string }>;
}) {
  const { topic, sort } = await searchParams;
  const [questions, topics, stories, user] = await Promise.all([
    getQuestions(),
    getTopics(),
    getPublishedStories(),
    getCurrentUser(),
  ]);
  const counts = countAnswersByQuestion(stories);
  const [authors, voteStates] = await Promise.all([
    getPublicUserMap(questions.map((question) => question.askedBy)),
    getVoteStates(
      questions.map((question) => question.id),
      user?.id ?? null,
    ),
  ]);

  let list = topic ? questions.filter((question) => question.topicIds.includes(topic)) : [...questions];
  switch (sort) {
    case "newest":
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "unanswered":
      list = list.filter((question) => (counts[question.id] ?? 0) === 0);
      break;
    default:
      list.sort((a, b) => b.upvotes - a.upvotes);
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <PageHeader
        title="Questions"
        description="Read questions from young people. Choose one to read the answers, or ask your own."
      >
        {user?.role === "drop" ? (
          <ButtonLink href="/questions/new" size="lg">
            Ask a question
          </ButtonLink>
        ) : null}
      </PageHeader>

      <section aria-labelledby="browse-heading" className="space-y-5">
        <h2 id="browse-heading" className="text-2xl font-bold tracking-tight text-ink">
          Browse questions
        </h2>
        <QuestionFilterBar topics={topics} activeTopic={topic} activeSort={sort} />

        {list.length > 0 ? (
          <ul className="space-y-4">
            {list.map((question) => (
              <li key={question.id}>
                <QuestionCard
                  question={question}
                  topics={topics}
                  answerCount={counts[question.id] ?? 0}
                  author={question.askedBy ? authors[question.askedBy] ?? null : null}
                  voteState={voteStates[question.id]}
                  signedIn={Boolean(user)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No questions match this filter"
            description="Try a different topic or sort, or ask a new question."
          >
            <ButtonLink href="/questions" variant="secondary">
              Clear filters
            </ButtonLink>
          </EmptyState>
        )}
      </section>

      {user?.role !== "drop" ? (
        <section className="rounded-2xl border border-seaglass/40 bg-seaglass/25 p-6">
          <h2 className="text-2xl font-semibold text-ink">
            {user?.role === "river" ? "Answer a question" : "Sign in to ask a question"}
          </h2>
          <p className="mt-2 text-lg text-ink/70">
            {user?.role === "river"
              ? "Rivers answer questions. Choose one you have personal experience with."
              : "Sign in as a Drop to ask a question and learn from a River."}
          </p>
          <ButtonLink
            href={user?.role === "river" ? "/senior" : "/login"}
            className="mt-4"
          >
            {user?.role === "river" ? "Answer a question" : "Sign in to ask"}
          </ButtonLink>
        </section>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";

import { AskQuestionForm } from "@/components/ask-question-form";
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
        description="Ask a question, add topics, and upvote the ones you want answered."
      />

      <AskQuestionForm topics={topics} canAsk={user?.role === "drop"} signedIn={Boolean(user)} />

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
            description="Try a different topic or sort, or post a new question above."
          >
            <ButtonLink href="/questions" variant="secondary">
              Clear filters
            </ButtonLink>
          </EmptyState>
        )}
      </section>
    </div>
  );
}

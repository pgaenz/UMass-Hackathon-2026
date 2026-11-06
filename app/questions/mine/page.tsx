import type { Metadata } from "next";
import Link from "next/link";

import {
  MyQuestionsList,
  type MyQuestionItem,
} from "@/components/my-questions-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { deriveDropQuestionState } from "@/lib/drop-question-state";
import { getQuestionsByUser, getTopics } from "@/lib/questions";
import { requireRole } from "@/lib/session";
import { getAllStories } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My questions",
};

export default async function MyQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; highlight?: string }>;
}) {
  const session = await requireRole("drop");
  const { notice, highlight } = await searchParams;
  const [questions, topics, stories] = await Promise.all([
    getQuestionsByUser(session.userId),
    getTopics(),
    getAllStories(),
  ]);

  const items: MyQuestionItem[] = questions.map((question) => {
    const linked = stories.filter(
      (story) =>
        story.questionId === question.id || question.storyIds.includes(story.id),
    );
    const state = deriveDropQuestionState(question, linked);
    return {
      id: question.id,
      text: question.text,
      topicIds: question.topicIds,
      labels: question.topicIds
        .map((id) => topics.find((topic) => topic.id === id)?.label)
        .filter((label): label is string => Boolean(label)),
      stateId: state.id,
      stateLabel: state.label,
      storyId: state.storyId,
      edited: state.edited,
      hasTopics: state.hasTopics,
      lastChanged: question.updatedAt ?? question.createdAt,
      canChange: linked.length === 0,
    };
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10" data-tour="my-questions">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">My questions</h1>
          <p className="mt-2 text-lg text-ink/70">
            Questions you have asked, and what has happened to them.
          </p>
        </div>
        <ButtonLink href="/questions/new">Ask a question</ButtonLink>
      </div>

      {notice ? (
        <p role="status" className="rounded-xl bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean">
          {notice}
        </p>
      ) : null}

      {items.length > 0 ? (
        <MyQuestionsList items={items} topics={topics} highlight={highlight} />
      ) : (
        <EmptyState
          title="You have not asked a question yet."
          description="Ask something you would really like an older person's experience of. Rivers will see it on Answer a question."
        >
          <ButtonLink href="/questions/new">Ask a question</ButtonLink>
        </EmptyState>
      )}

      <Link href="/questions" className="inline-block text-lg font-semibold text-brand hover:underline">
        ← Browse all questions
      </Link>
    </div>
  );
}

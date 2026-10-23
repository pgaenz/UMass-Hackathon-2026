import type { Metadata } from "next";

import { AnswerSortBar } from "@/components/answer-sort-bar";
import { StoryCard } from "@/components/story-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { answerTopics, getPublishedStories } from "@/lib/answers";
import { getLikeStates } from "@/lib/likes";
import { getQuestionMap, getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import type { Question, Story } from "@/lib/types";
import { getPublicUserMap } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stories from Rivers",
};

type Sort = "newest" | "likes" | "topic";

/** Alphabetically first canonical topic label for an answer; "" if unfiled. */
function firstTopicLabel(
  story: Story,
  questionMap: Record<string, Question>,
  labels: Map<string, string>,
): string {
  const question = story.questionId ? questionMap[story.questionId] : null;
  return (
    answerTopics(story, question)
      .map((id) => labels.get(id))
      .filter((label): label is string => Boolean(label))
      .sort((a, b) => a.localeCompare(b))[0] ?? ""
  );
}

export default async function YouthPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; topic?: string }>;
}) {
  const { sort: rawSort, topic } = await searchParams;
  const sort: Sort = rawSort === "likes" || rawSort === "topic" ? rawSort : "newest";

  const [stories, viewer, topics] = await Promise.all([
    getPublishedStories(),
    getCurrentUser(),
    getTopics(),
  ]);

  const [authors, likeStates, questionMap] = await Promise.all([
    getPublicUserMap(stories.map((story) => story.authorId)),
    getLikeStates(
      stories.map((story) => story.id),
      viewer?.id ?? null,
    ),
    getQuestionMap(stories.map((story) => story.questionId)),
  ]);

  const topicLabels = new Map(topics.map((item) => [item.id, item.label]));

  const filtered = topic
    ? stories.filter((story) => {
        const question = story.questionId ? questionMap[story.questionId] : null;
        return answerTopics(story, question).includes(topic);
      })
    : stories;

  const ordered = [...filtered].sort((a, b) => {
    if (sort === "likes") {
      const diff = (likeStates[b.id]?.count ?? 0) - (likeStates[a.id]?.count ?? 0);
      if (diff !== 0) return diff;
    }
    if (sort === "topic") {
      const labelA = firstTopicLabel(a, questionMap, topicLabels);
      const labelB = firstTopicLabel(b, questionMap, topicLabels);
      if (!labelA && labelB) return 1;
      if (labelA && !labelB) return -1;
      const compare = labelA.localeCompare(labelB);
      if (compare !== 0) return compare;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <PageHeader
        title="Stories from Rivers"
        description="Every story here was published by a River, with no invented facts."
      />

      <AnswerSortBar
        topics={topics}
        activeTopic={topic ?? null}
        activeSort={sort}
        basePath="/youth"
      />

      {ordered.length > 0 ? (
        <ul className="space-y-5">
          {ordered.map((story) => {
            const question = story.questionId
              ? questionMap[story.questionId] ?? null
              : null;
            return (
              <li key={story.id}>
                <StoryCard
                  story={story}
                  author={story.authorId ? authors[story.authorId] ?? null : null}
                  likeState={likeStates[story.id] ?? { liked: false, count: 0 }}
                  signedIn={Boolean(viewer)}
                  question={question ? { id: question.id, text: question.text } : null}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={topic ? "No stories in this topic yet" : "No stories yet"}
          description="New answers will appear here once a River reviews and approves them."
        >
          <ButtonLink href="/questions">Ask a question</ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}

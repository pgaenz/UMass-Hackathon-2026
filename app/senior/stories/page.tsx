import type { Metadata } from "next";
import Link from "next/link";

import { StoryActions } from "@/components/story-actions";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, getArticleTitle, truncate } from "@/lib/format";
import { getQuestionMap } from "@/lib/questions";
import { deriveRiverState } from "@/lib/river-story-state";
import { requireRole } from "@/lib/session";
import { getStoriesByAuthor } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My stories",
};

type Filter = "all" | "published" | "not_published";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "not_published", label: "Not published yet" },
];

function updatedAtOf(story: { updatedAt?: string; createdAt: string }): string {
  return story.updatedAt ?? story.createdAt;
}

export default async function MyStoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; notice?: string }>;
}) {
  const session = await requireRole("river");
  const { show, notice } = await searchParams;
  const filter: Filter =
    show === "published" || show === "not_published" ? show : "all";

  const stories = await getStoriesByAuthor(session.userId);
  const sorted = [...stories].sort((a, b) => updatedAtOf(b).localeCompare(updatedAtOf(a)));
  const published = sorted.filter((story) => story.status === "published");
  const counts: Record<Filter, number> = {
    all: sorted.length,
    published: published.length,
    not_published: sorted.length - published.length,
  };
  const visible =
    filter === "published"
      ? published
      : filter === "not_published"
        ? sorted.filter((story) => story.status !== "published")
        : sorted;

  const questionMap = await getQuestionMap(visible.map((story) => story.questionId));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
      <PageHeader
        title="My stories"
        description="Your answers and stories. Only you can see the ones that are not published."
      />

      {notice === "deleted" ? (
        <p role="status" className="rounded-xl bg-seaglass/40 px-5 py-4 text-lg text-ocean">
          Story deleted.
        </p>
      ) : null}
      {notice === "saved" ? (
        <p role="status" className="rounded-xl bg-seaglass/40 px-5 py-4 text-lg text-ocean">
          Saved. You can write your story whenever you are ready.
        </p>
      ) : null}

      <nav aria-label="Filter your stories" className="flex flex-wrap gap-3">
        {FILTERS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "all" ? "/senior/stories" : `/senior/stories?show=${item.id}`}
            aria-current={filter === item.id ? "page" : undefined}
            className={
              filter === item.id
                ? "min-h-11 rounded-xl bg-brand px-4 py-2.5 text-lg font-semibold text-white"
                : "min-h-11 rounded-xl border border-seaglass bg-white/60 px-4 py-2.5 text-lg font-semibold text-ocean hover:border-brand"
            }
          >
            {item.label} ({counts[item.id]})
          </Link>
        ))}
      </nav>

      {sorted.length === 0 ? (
        <EmptyState
          title="You have not answered a question yet."
          description="When you answer a question, it will appear here so you can write, edit, and publish it in your own time."
        >
          <ButtonLink href="/senior">Find a question to answer</ButtonLink>
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No stories match this filter"
          description="There is nothing in this view yet."
        >
          <ButtonLink href="/senior/stories" variant="secondary">
            Show all stories
          </ButtonLink>
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {visible.map((story) => {
            const state = deriveRiverState(story);
            const question = story.questionId ? questionMap[story.questionId] ?? null : null;
            const title =
              getArticleTitle(story.article) ||
              (question ? `Answer to: ${truncate(question.text, 60)}` : "Untitled answer");
            const isPublished = story.status === "published";
            return (
              <li
                key={story.id}
                className="space-y-4 rounded-2xl glass shadow-water p-5 shadow-sm sm:p-6"
              >
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold leading-snug text-ink sm:text-2xl">
                    {isPublished ? (
                      <Link href={`/youth/${story.id}`} className="underline-offset-4 hover:underline">
                        {title}
                      </Link>
                    ) : (
                      title
                    )}
                  </h2>
                  {question ? (
                    <p className="text-base text-ink/70">
                      Answers{" "}
                      <Link
                        href={`/questions/${question.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {truncate(question.text, 80)}
                      </Link>
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-ink/70">
                  <span className="font-medium text-ink">{state.label}</span>
                  <span aria-hidden="true">·</span>
                  <span>Last changed {formatDate(updatedAtOf(story))}</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <ButtonLink href={isPublished ? `/youth/${story.id}` : `/senior/review/${story.id}`}>
                    {state.primaryAction}
                  </ButtonLink>
                  {isPublished ? (
                    <ButtonLink href={`/senior/review/${story.id}`} variant="secondary">
                      Edit story
                    </ButtonLink>
                  ) : null}
                </div>

                <StoryActions storyId={story.id} published={isPublished} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleRenderer } from "@/components/article-renderer";
import { ReviewActions } from "@/components/review-actions";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getStory } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review your story",
};

export default async function ReviewStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();

  const review = story.review;
  const passed = review?.verdict === "pass";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <Link href="/senior" className="text-lg font-semibold text-brand hover:underline">
        ← Answer another question
      </Link>

      <PageHeader
        title="Review your story"
        description="This is the article we wrote from your answer. Read it, then publish it or ask us to change it."
      />

      {story.status === "published" ? (
        <p className="rounded-2xl bg-green-50 px-6 py-4 text-lg font-medium text-green-900">
          This story is published and live in the youth feed.
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-ink">Your original answer</h2>
          <div className="whitespace-pre-wrap rounded-2xl border border-orange-100 bg-surface p-6 text-lg leading-relaxed text-ink">
            {story.transcript}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-ink">The story we wrote</h2>
          {story.article ? (
            <div className="rounded-2xl border border-orange-100 bg-surface p-6 shadow-sm">
              <ArticleRenderer markdown={story.article} />
            </div>
          ) : (
            <p className="rounded-2xl border border-orange-100 bg-surface p-6 text-lg text-ink/70">
              We have not written the story yet.
            </p>
          )}
        </section>
      </div>

      {review ? (
        <section className="space-y-4 rounded-2xl border border-orange-100 bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-ink">Editor review</h2>
            <Badge
              className={passed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
            >
              {passed ? `Passed · ${review.score}/5` : `Needs changes · ${review.score}/5`}
            </Badge>
          </div>
          <p className="text-lg text-ink">{review.summary}</p>
          {review.issues.length > 0 ? (
            <ul className="space-y-3">
              {review.issues.map((issue, index) => (
                <li key={index} className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">
                    {issue.type.replace("_", " ")}
                  </p>
                  <p className="mt-1 text-lg text-ink">{issue.detail}</p>
                  {issue.excerpt ? (
                    <blockquote className="mt-2 border-l-4 border-orange-300 pl-3 text-base italic text-ink/70">
                      “{issue.excerpt}”
                    </blockquote>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {story.feedback.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-orange-100 bg-surface p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-ink">What you asked us to change</h2>
          <ul className="space-y-2">
            {story.feedback.map((entry) => (
              <li key={entry.id} className="text-lg text-ink/80">
                • {entry.text || "(recorded feedback)"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {story.status !== "published" ? (
        <ReviewActions storyId={story.id} passed={Boolean(passed)} />
      ) : null}
    </div>
  );
}

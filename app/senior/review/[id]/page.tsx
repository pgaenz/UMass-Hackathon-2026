import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnswerEditor } from "@/components/answer-editor";
import { ArticleRenderer } from "@/components/article-renderer";
import { CheckAgainButton } from "@/components/check-again-button";
import { ReviewActions } from "@/components/review-actions";
import { StoryActions } from "@/components/story-actions";
import { StoryEditor } from "@/components/story-editor";
import { WriteStoryButton } from "@/components/write-story-button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { formatTime, truncate } from "@/lib/format";
import { getQuestionMap } from "@/lib/questions";
import { deriveRiverState } from "@/lib/river-story-state";
import { requireRole } from "@/lib/session";
import { getOwnedStory } from "@/lib/story-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review your story",
};

export default async function ReviewStoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ transcriptionFailed?: string }>;
}) {
  const { id } = await params;
  const { transcriptionFailed } = await searchParams;
  const session = await requireRole("river");
  const story = await getOwnedStory(id, session.userId);
  // Non-owners and missing stories look identical, so existence is not revealed.
  if (!story) notFound();

  const state = deriveRiverState(story);
  const review = story.review;
  const passed = review?.verdict === "pass";
  const questionMap = await getQuestionMap([story.questionId]);
  const question = story.questionId ? questionMap[story.questionId] ?? null : null;
  const publishReady = story.checkedAt !== null && !state.answerChangedSinceWriting;
  const updatedAt = story.updatedAt ?? story.createdAt;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <Link href="/senior/stories" className="text-lg font-semibold text-brand hover:underline">
        ← My stories
      </Link>

      <PageHeader
        title="Review your story"
        description="Read it, correct anything that does not sound right, then decide whether to publish it. Nothing is published unless you choose to publish."
      />

      <section className="space-y-2 rounded-2xl glass shadow-water px-6 py-5 shadow-sm">
        <p className="text-lg text-ink/70">This story is</p>
        <p className="text-2xl font-semibold text-ink">{state.label}</p>
        {state.answerChangedSinceWriting ? (
          <p className="text-base font-semibold text-ocean">
            Your answer changed. Write the story again?
          </p>
        ) : null}
        {story.checkError ? (
          <p role="status" className="text-base text-ocean">
            Your changes are saved. We could not check them yet.
          </p>
        ) : null}
      </section>

      {transcriptionFailed === "1" ? (
        <p role="status" className="rounded-xl bg-sunset/30 px-5 py-4 text-lg text-ink">
          We could not hear your recording clearly. Type your answer here, or record again.
        </p>
      ) : null}

      {story.status === "published" ? (
        <section className="space-y-4 rounded-2xl bg-seaglass/40 px-6 py-5 text-lg text-ocean">
          <p className="font-semibold">Your story is published. Anyone can read it on Read stories.</p>
          <StoryActions storyId={story.id} published />
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-ink">Your story</h2>
            {story.riverEdited ? <Badge className="bg-seaglass/60 text-ocean">You edited this story</Badge> : null}
          </div>
          {story.article ? (
            <div className="rounded-2xl glass shadow-water p-6 shadow-sm">
              <ArticleRenderer markdown={story.article} />
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl glass shadow-water p-6 shadow-sm">
              <p className="text-lg text-ink/70">
                We have not written the story yet. Save your answer, then write it whenever you are
                ready.
              </p>
              <WriteStoryButton storyId={story.id} />
            </div>
          )}
          {story.article ? (
            <StoryEditor
              storyId={story.id}
              article={story.article}
              updatedAt={updatedAt}
              published={story.status === "published"}
            />
          ) : null}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-ink">Your answer</h2>
          <div className="whitespace-pre-wrap rounded-2xl glass shadow-water p-6 text-lg leading-relaxed text-ink">
            {story.transcript || "No answer yet."}
          </div>
          <AnswerEditor
            storyId={story.id}
            transcript={story.transcript}
            updatedAt={updatedAt}
            hasArticle={Boolean(story.article)}
            previousArticle={story.previousArticle ?? null}
            answerChanged={state.answerChangedSinceWriting}
          />
        </section>
      </div>

      {story.status !== "published" ? (
        <ReviewActions
          storyId={story.id}
          passed={Boolean(passed)}
          safetyBlocked={story.safety?.verdict === "block"}
          publishReady={publishReady}
          answerChanged={state.answerChangedSinceWriting}
          checkedAt={story.checkedAt ?? null}
        />
      ) : null}

      <section aria-labelledby="checks-heading" className="space-y-4">
        <div className="space-y-2">
          <h2 id="checks-heading" className="text-2xl font-bold tracking-tight text-ink">
            What our checks found
          </h2>
          <p className="max-w-3xl text-lg text-ink/70">
            These checks help the writing stay close to your answer and keep the site
            family-friendly. A passing check is not proof that a story is true — you decide
            whether the story is right.
          </p>
          {story.checkedAt ? (
            <p className="text-base text-ink/70">Checked at {formatTime(story.checkedAt)}</p>
          ) : (
            <p className="text-base text-ink/70">Not checked yet.</p>
          )}
          <CheckAgainButton storyId={story.id} />
        </div>

        {story.safety ? (
          <div className="space-y-4 rounded-2xl glass shadow-water p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold text-ink">Safety check</h3>
              <Badge
                className={
                  story.safety.verdict === "allow"
                    ? "bg-brand/15 text-brand"
                    : "bg-brand/20 text-ocean"
                }
              >
                {story.safety.verdict === "allow"
                  ? "Safe to publish"
                  : story.safety.verdict === "block"
                    ? "Cannot publish"
                    : "Needs a small change"}
              </Badge>
            </div>
            <p className="text-lg text-ink">{story.safety.summary}</p>
            {story.safety.issues.length > 0 ? (
              <ul className="space-y-3">
                {story.safety.issues.map((issue, index) => (
                  <li key={index} className="rounded-xl border border-seaglass/40 bg-seaglass/25 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                      {issue.category.replace("_", " ")} · {issue.severity}
                    </p>
                    <p className="mt-1 text-lg text-ink">{issue.detail}</p>
                    {issue.excerpt ? (
                      <blockquote className="mt-2 border-l-4 border-seaglass pl-3 text-base italic text-ink/70">
                        “{issue.excerpt}”
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {review ? (
          <div className="space-y-4 rounded-2xl glass shadow-water p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold text-ink">Accuracy and clarity check</h3>
              <Badge className={passed ? "bg-brand/15 text-ocean" : "bg-seaglass/60 text-ocean"}>
                {passed ? `Passed · ${review.score}/5` : `Needs changes · ${review.score}/5`}
              </Badge>
            </div>
            <p className="text-lg text-ink">{review.summary}</p>
            {review.issues.length > 0 ? (
              <ul className="space-y-3">
                {review.issues.map((issue, index) => (
                  <li key={index} className="rounded-xl border border-seaglass/40 bg-seaglass/25 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                      {issue.type.replace("_", " ")}
                    </p>
                    <p className="mt-1 text-lg text-ink">{issue.detail}</p>
                    {issue.excerpt ? (
                      <blockquote className="mt-2 border-l-4 border-seaglass pl-3 text-base italic text-ink/70">
                        “{issue.excerpt}”
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      {story.feedback.length > 0 ? (
        <section className="space-y-3 rounded-2xl glass shadow-water p-6 shadow-sm">
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
    </div>
  );
}

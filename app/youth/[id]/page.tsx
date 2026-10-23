import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleRenderer } from "@/components/article-renderer";
import { MessageButton } from "@/components/chat/message-button";
import { CopyButton } from "@/components/copy-button";
import { LikeButton } from "@/components/like-button";
import { ReportButton } from "@/components/report-button";
import { Badge } from "@/components/ui/badge";
import { canSendTo } from "@/lib/chat";
import { firstName, formatDate, getArticleTitle, toPlainText } from "@/lib/format";
import { getLikeStates } from "@/lib/likes";
import { getQuestion } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import { getStory } from "@/lib/store";
import { getUser, toPublicUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(id);
  return { title: story ? getArticleTitle(story.article) || "Story" : "Story" };
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await getStory(id);
  if (!story || story.status !== "published") notFound();

  const [question, author, viewer] = await Promise.all([
    story.questionId ? getQuestion(story.questionId) : Promise.resolve(null),
    story.authorId ? getUser(story.authorId) : Promise.resolve(null),
    getCurrentUser(),
  ]);
  const authorRef = author ? toPublicUser(author) : null;
  const canAskAuthor = canSendTo(viewer, author);
  const likeStates = await getLikeStates([story.id], viewer?.id ?? null);
  const likeState = likeStates[story.id] ?? { liked: false, count: 0 };
  const title = getArticleTitle(story.article) || "A story from a River";

  return (
    <article className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <Link href="/youth" className="text-lg font-semibold text-brand hover:underline">
        ← All stories
      </Link>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold leading-snug tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-base text-ink/70">
          {story.metadata.topic ? <Badge>{story.metadata.topic}</Badge> : null}
          <time dateTime={story.createdAt}>{formatDate(story.createdAt)}</time>
          {authorRef ? (
            <Link href={`/profile/${authorRef.id}`} className="font-medium text-brand hover:underline">
              by {authorRef.name}
            </Link>
          ) : (
            <span>HistorAI community</span>
          )}
          <LikeButton
            storyId={story.id}
            initialLiked={likeState.liked}
            initialCount={likeState.count}
            signedIn={Boolean(viewer)}
          />
          <CopyButton text={title} context={title} />
          <ReportButton targetType="story" targetId={story.id} />
        </div>
      </header>

      {question ? (
        <p className="rounded-2xl glass shadow-water p-4 text-lg text-ink">
          <span className="font-semibold text-ink/60">Answering: </span>
          <Link
            href={`/questions/${question.id}`}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            {question.text}
          </Link>
        </p>
      ) : null}

      {story.article.trim() ? (
        <div className="flex flex-wrap items-center justify-end">
          <CopyButton text={toPlainText(story.article)} />
        </div>
      ) : null}

      <ArticleRenderer markdown={story.article} />

      {author && canAskAuthor ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl glass shadow-water p-6">
          <h2 className="text-xl font-bold tracking-tight text-ink">
            Want to know more about {author.name}?
          </h2>
          <MessageButton
            participantId={author.id}
            label={`Ask ${firstName(author.name)} a Question?`}
            variant="secondary"
          />
        </section>
      ) : null}
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleRenderer } from "@/components/article-renderer";
import { ReportButton } from "@/components/report-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, getArticleTitle } from "@/lib/format";
import { getQuestion } from "@/lib/questions";
import { getStory } from "@/lib/store";

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

  const question = story.questionId ? await getQuestion(story.questionId) : null;
  const title = getArticleTitle(story.article) || "A story from a senior";

  return (
    <article className="space-y-8">
      <Link href="/youth" className="text-lg font-semibold text-sky-800 hover:underline">
        ← All stories
      </Link>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold leading-snug tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-base text-slate-600">
          {story.metadata.topic ? <Badge>{story.metadata.topic}</Badge> : null}
          <time dateTime={story.createdAt}>{formatDate(story.createdAt)}</time>
          <ReportButton targetType="story" targetId={story.id} />
        </div>
      </header>

      <ArticleRenderer markdown={story.article} />

      {question ? (
        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">The question behind this story</h2>
          <p className="mt-2 text-lg text-slate-700">{question.text}</p>
          <ButtonLink href={`/questions/${question.id}`} variant="secondary" className="mt-4">
            See the question
          </ButtonLink>
        </aside>
      ) : null}
    </article>
  );
}

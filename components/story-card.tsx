import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDate, getArticleTitle } from "@/lib/format";
import type { Story } from "@/lib/types";

export function StoryCard({ story }: { story: Story }) {
  const title = getArticleTitle(story.article) || story.metadata.topic || "A story from a senior";

  return (
    <article className="rounded-2xl border border-orange-100 bg-surface p-6 shadow-sm transition hover:border-brand hover:shadow-md">
      <Link href={`/youth/${story.id}`} className="block space-y-3">
        <h2 className="text-2xl font-semibold leading-snug text-ink underline-offset-4 hover:underline">
          {title}
        </h2>
        {story.metadata.summary ? (
          <p className="text-lg text-ink/70">{story.metadata.summary}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-base text-gray-500">
          {story.metadata.topic ? <Badge>{story.metadata.topic}</Badge> : null}
          <time dateTime={story.createdAt}>{formatDate(story.createdAt)}</time>
        </div>
      </Link>
    </article>
  );
}

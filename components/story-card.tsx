import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatDate, getArticleTitle } from "@/lib/format";
import type { AuthorRef, Story } from "@/lib/types";

export function StoryCard({ story, author }: { story: Story; author?: AuthorRef | null }) {
  const title = getArticleTitle(story.article) || story.metadata.topic || "A story from a River";

  return (
    <article className="lift rounded-2xl glass shadow-water p-6">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold leading-snug text-ink">
          <Link href={`/youth/${story.id}`} className="underline-offset-4 hover:underline">
            {title}
          </Link>
        </h2>
        {story.metadata.summary ? (
          <p className="text-lg text-ink/70">{story.metadata.summary}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-ink/70">
          {story.metadata.topic ? <Badge>{story.metadata.topic}</Badge> : null}
          <time dateTime={story.createdAt}>{formatDate(story.createdAt)}</time>
          {author ? (
            <Link href={`/profile/${author.id}`} className="font-medium text-brand hover:underline">
              by {author.name}
            </Link>
          ) : (
            <span>HistorAI community</span>
          )}
        </div>
      </div>
    </article>
  );
}

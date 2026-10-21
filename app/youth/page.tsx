import type { Metadata } from "next";

import { StoryCard } from "@/components/story-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPublishedStories } from "@/lib/answers";
import { getPublicUserMap } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stories from Rivers",
};

export default async function YouthPage() {
  const stories = await getPublishedStories();
  const authors = await getPublicUserMap(stories.map((story) => story.authorId));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <PageHeader
        title="Stories from Rivers"
        description="Every story here was published by a River, with no invented facts."
      />

      {stories.length > 0 ? (
        <ul className="space-y-5">
          {stories.map((story) => (
            <li key={story.id}>
              <StoryCard
                story={story}
                author={story.authorId ? authors[story.authorId] ?? null : null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No stories yet"
          description="New answers will appear here once a River reviews and approves them."
        >
          <ButtonLink href="/questions">Ask a question</ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}

import type { Metadata } from "next";

import { StoryCard } from "@/components/story-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getPublishedStories } from "@/lib/answers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stories from seniors",
};

export default async function YouthPage() {
  const stories = await getPublishedStories();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <PageHeader
        title="Stories from seniors"
        description="Every story here was published by a senior, with no invented facts."
      />

      {stories.length > 0 ? (
        <ul className="space-y-5">
          {stories.map((story) => (
            <li key={story.id}>
              <StoryCard story={story} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No stories yet"
          description="New answers will appear here once a senior reviews and approves them."
        >
          <ButtonLink href="/questions">Ask a question</ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}

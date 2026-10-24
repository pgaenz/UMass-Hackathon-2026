import type { Metadata } from "next";

import { PodcastBuilder } from "@/components/podcast/podcast-builder";
import { PageHeader } from "@/components/ui/page-header";
import { getPublishedStories } from "@/lib/answers";
import { toPlainText } from "@/lib/format";
import { PODCAST_WORDS_PER_MINUTE } from "@/lib/podcast-types";
import { getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Podcasts",
  description:
    "Build a personal listening episode from real stories shared by Rivers in the HistorAI community.",
};

function countWords(text: string): number {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

export default async function PodcastsPage() {
  const [topics, stories, user] = await Promise.all([
    getTopics(),
    getPublishedStories(),
    getCurrentUser(),
  ]);

  const libraryWords = stories.reduce(
    (total, story) => total + countWords(toPlainText(story.article)),
    0,
  );
  const libraryMinutes = Math.max(
    1,
    Math.round(libraryWords / PODCAST_WORDS_PER_MINUTE),
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 px-6 py-10">
      <PageHeader
        title="Podcasts"
        description="Choose what you are curious about, pick a length, and let HistorAI weave real stories from Rivers into a personal listening episode."
      />

      <section className="space-y-3 rounded-2xl border border-seaglass/50 bg-white/55 p-6 shadow-water">
        <h2 className="text-2xl font-bold tracking-tight text-ink">What podcast mode does</h2>
        <p className="text-lg leading-relaxed text-ink/75">
          Podcast mode turns published stories into a personal listening episode. Choose the
          interests you care about, or let Random pick a mix, then set a target of 15, 30, or 45
          minutes. A warm host introduces each River by name, connects the themes between their
          stories, and explains how listeners can find them on HistorAI and send a private
          message. The current library holds {stories.length}{" "}
          {stories.length === 1 ? "story" : "stories"}, about {libraryMinutes} minutes of source
          material. Episodes play right on the page with play, pause, stop, 15-second skip
          controls, a seek bar for moving anywhere in the episode, and subtitles that follow the
          spoken narration.
        </p>
      </section>

      <PodcastBuilder
        topics={topics}
        defaultTopics={user?.interests ?? []}
        signedIn={Boolean(user)}
        libraryMinutes={libraryMinutes}
      />
    </div>
  );
}

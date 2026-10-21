import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuestionCard } from "@/components/question-card";
import { StoryCard } from "@/components/story-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getQuestionsByUser, getTopics } from "@/lib/questions";
import { getSession } from "@/lib/session";
import { getStoriesByAuthor } from "@/lib/store";
import { getUser, toPublicUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getUser(id);
  return { title: user ? user.name : "Profile" };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  const [session, topics, published] = await Promise.all([
    getSession(),
    getTopics(),
    getPublishedStories(),
  ]);
  const profile = toPublicUser(user);
  const isSelf = session?.userId === user.id;
  const isRiver = user.role === "river";

  const questions = isRiver ? [] : await getQuestionsByUser(user.id);
  const stories = isRiver
    ? (await getStoriesByAuthor(user.id)).filter((story) => story.status === "published")
    : [];
  const counts = countAnswersByQuestion(published);
  const author = { id: user.id, name: user.name };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-6 py-10">
      <header className="space-y-4 rounded-3xl glass shadow-water p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-seaglass/25 text-4xl" aria-hidden="true">
            {isRiver ? "🌊" : "💧"}
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">{profile.name}</h1>
            <p className="text-lg text-ink/70">
              {isRiver ? "River · Older adult" : "Drop · Young person"} · {profile.ageBand}
            </p>
          </div>
        </div>

        {profile.bio ? <p className="text-lg text-ink/80">{profile.bio}</p> : null}

        {profile.interests.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Interests">
            {profile.interests.map((interest) => (
              <li key={interest}>
                <Badge>{topics.find((topic) => topic.id === interest)?.label ?? interest}</Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {isSelf ? (
          <ButtonLink href="/profile" variant="secondary">
            Edit your profile
          </ButtonLink>
        ) : null}
      </header>

      <section aria-labelledby="profile-content-heading" className="space-y-5">
        <h2 id="profile-content-heading" className="text-2xl font-bold tracking-tight text-ink">
          {isRiver ? "Stories by this River" : "Questions from this Drop"}
        </h2>

        {isRiver ? (
          stories.length > 0 ? (
            <ul className="space-y-5">
              {stories.map((story) => (
                <li key={story.id}>
                  <StoryCard story={story} author={author} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-lg text-ink/70">No published stories yet.</p>
          )
        ) : questions.length > 0 ? (
          <ul className="space-y-4">
            {questions.map((question) => (
              <li key={question.id}>
                <QuestionCard
                  question={question}
                  topics={topics}
                  answerCount={counts[question.id] ?? 0}
                  author={author}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-lg text-ink/70">No questions yet.</p>
        )}
      </section>

      <Link href="/" className="inline-block text-lg font-semibold text-brand hover:underline">
        ← Back to the community
      </Link>
    </div>
  );
}

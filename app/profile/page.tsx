import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { ProfileForm } from "@/components/profile-form";
import { QuestionCard } from "@/components/question-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { countAnswersByQuestion, getPublishedStories } from "@/lib/answers";
import { getArticleTitle } from "@/lib/format";
import { getQuestionsByUser, getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import { getStoriesByAuthor } from "@/lib/store";
import { toPublicUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const topics = await getTopics();
  const isRiver = user.role === "river";
  const author = { id: user.id, name: user.name };

  const [questions, stories, published] = await Promise.all([
    isRiver ? Promise.resolve([]) : getQuestionsByUser(user.id),
    isRiver ? getStoriesByAuthor(user.id) : Promise.resolve([]),
    getPublishedStories(),
  ]);
  const counts = countAnswersByQuestion(published);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={user.name}
          description={`${isRiver ? "River · Older adult" : "Drop · Young person"} · ${
            toPublicUser(user).ageBand
          }`}
        />
        <LogoutButton />
      </div>

      <ProfileForm user={user} topics={topics} />

      <section aria-labelledby="contributions-heading" className="space-y-5">
        <h2 id="contributions-heading" className="text-2xl font-bold tracking-tight text-ink">
          {isRiver ? "Your stories" : "Your questions"}
        </h2>

        {isRiver ? (
          stories.length > 0 ? (
            <ul className="space-y-3">
              {stories.map((story) => (
                <li
                  key={story.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl glass shadow-water p-5 shadow-sm"
                >
                  <Link
                    href={story.status === "published" ? `/youth/${story.id}` : `/senior/review/${story.id}`}
                    className="text-lg font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                  >
                    {getArticleTitle(story.article) || story.prompt || "Untitled story"}
                  </Link>
                  <Badge>{story.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-lg text-ink/70">
              You have not shared a story yet.{" "}
              <Link href="/senior" className="font-semibold text-brand hover:underline">
                Answer a question
              </Link>
              .
            </p>
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
          <p className="text-lg text-ink/70">
            You have not asked a question yet.{" "}
            <Link href="/questions" className="font-semibold text-brand hover:underline">
              Ask one
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

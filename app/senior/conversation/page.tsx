import type { Metadata } from "next";
import Link from "next/link";

import { VoiceConversation } from "@/components/voice-conversation";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getQuestion } from "@/lib/questions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Talk with an interviewer",
};

export default async function ConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>;
}) {
  const { question: questionId } = await searchParams;
  const question = questionId ? await getQuestion(questionId) : null;

  if (!question) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
        <PageHeader
          title="Talk with an interviewer"
          description="Choose a question first, then have a relaxed conversation about it."
        />
        <ButtonLink href="/senior">Choose a question</ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <Link href="/senior" className="text-lg font-semibold text-brand hover:underline">
        ← Choose a different question
      </Link>

      <PageHeader
        title="Talk with an interviewer"
        description="Speak naturally. The interviewer will listen, wait through pauses, and ask one question at a time."
      />

      <div className="rounded-2xl border-l-4 border-brand bg-seaglass/25 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Today’s question
        </p>
        <p className="mt-2 text-2xl font-semibold leading-snug text-ink">{question.text}</p>
      </div>

      <VoiceConversation questionId={question.id} questionText={question.text} />
    </div>
  );
}

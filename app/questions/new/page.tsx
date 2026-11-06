import type { Metadata } from "next";

import { AskQuestionForm } from "@/components/ask-question-form";
import { getTopics } from "@/lib/questions";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask a question",
};

export default async function NewQuestionPage() {
  await requireRole("drop");
  const topics = await getTopics();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <AskQuestionForm topics={topics} />
    </div>
  );
}

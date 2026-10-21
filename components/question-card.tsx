import Link from "next/link";

import { ReportButton } from "@/components/report-button";
import { UpvoteButton } from "@/components/upvote-button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { Question, Topic } from "@/lib/types";

export function QuestionCard({
  question,
  topics,
  answerCount,
  href,
}: {
  question: Question;
  topics: Topic[];
  answerCount: number;
  href?: string;
}) {
  const labels = question.topicIds
    .map((id) => topics.find((topic) => topic.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const linkHref = href ?? `/questions/${question.id}`;

  return (
    <article className="flex gap-4 rounded-2xl border border-orange-100 bg-surface p-5 shadow-sm sm:gap-6 sm:p-6">
      <UpvoteButton questionId={question.id} initialCount={question.upvotes} />
      <div className="min-w-0 flex-1 space-y-3">
        <h2 className="text-xl font-semibold leading-snug text-ink sm:text-2xl">
          <Link href={linkHref} className="underline-offset-4 hover:underline">
            {question.text}
          </Link>
        </h2>
        {labels.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Topics">
            {labels.map((label) => (
              <li key={label}>
                <Badge>{label}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base text-ink/70">
          <span>{answerCount === 1 ? "1 answer" : `${answerCount} answers`}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
          <ReportButton targetType="question" targetId={question.id} />
        </div>
      </div>
    </article>
  );
}

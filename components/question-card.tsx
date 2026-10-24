import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { ListenButton } from "@/components/listen-button";
import { ReportButton } from "@/components/report-button";
import { UpvoteButton } from "@/components/upvote-button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { AuthorRef, Question, QuestionVoteState, Topic } from "@/lib/types";

export function QuestionCard({
  question,
  topics,
  answerCount,
  href,
  author,
  voteState,
  signedIn = false,
}: {
  question: Question;
  topics: Topic[];
  answerCount: number;
  href?: string;
  author?: AuthorRef | null;
  voteState?: QuestionVoteState;
  signedIn?: boolean;
}) {
  const labels = question.topicIds
    .map((id) => topics.find((topic) => topic.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const linkHref = href ?? `/questions/${question.id}`;

  return (
    <article
      data-tour="question-card"
      className="lift flex gap-4 rounded-2xl glass shadow-water p-5 sm:gap-6 sm:p-6"
    >
      <UpvoteButton
        questionId={question.id}
        initialCount={question.upvotes}
        initialVoted={voteState?.voted ?? false}
        signedIn={signedIn}
      />
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
          {author ? (
            <Link href={`/profile/${author.id}`} className="font-medium text-brand hover:underline">
              asked by {author.name}
            </Link>
          ) : (
            <span>Asked by the community</span>
          )}
          <CopyButton text={question.text} context={question.text} />
          <ListenButton text={question.text} context={question.text} />
          <ReportButton targetType="question" targetId={question.id} />
        </div>
      </div>
    </article>
  );
}

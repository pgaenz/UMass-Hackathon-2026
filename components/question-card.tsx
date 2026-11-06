import Link from "next/link";
import type { ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import { ListenButton } from "@/components/listen-button";
import { ReportButton } from "@/components/report-button";
import { UpvoteButton } from "@/components/upvote-button";
import { Badge } from "@/components/ui/badge";
import { formatDate, isNewQuestion, publicDisplayName } from "@/lib/format";
import { canLinkPublicProfile } from "@/lib/users";
import type { AuthorRef, Question, QuestionVoteState, Topic } from "@/lib/types";

export function QuestionCard({
  question,
  topics,
  answerCount,
  href,
  author,
  voteState,
  signedIn = false,
  action,
}: {
  question: Question;
  topics: Topic[];
  answerCount: number;
  href?: string;
  author?: AuthorRef | null;
  voteState?: QuestionVoteState;
  signedIn?: boolean;
  /** Optional call-to-action rendered under the question (e.g. "Answer this question"). */
  action?: ReactNode;
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
          {isNewQuestion(question.createdAt) ? (
            <span className="rounded-full border border-brand/40 px-2 py-0.5 text-sm font-semibold text-brand">
              New
            </span>
          ) : null}
          <span aria-hidden="true">·</span>
          <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
          {author ? (
            canLinkPublicProfile(author) ? (
              <Link href={`/profile/${author.id}`} className="font-medium text-brand hover:underline">
                asked by {publicDisplayName(author)}
              </Link>
            ) : (
              <span className="font-medium">asked by {publicDisplayName(author)}</span>
            )
          ) : (
            <span>Asked by the community</span>
          )}
          <CopyButton text={question.text} context={question.text} />
          <ListenButton text={question.text} context={question.text} />
          <ReportButton targetType="question" targetId={question.id} />
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </article>
  );
}

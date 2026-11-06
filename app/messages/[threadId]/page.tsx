import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlockButton } from "@/components/chat/block-button";
import { MessageThread } from "@/components/chat/message-thread";
import { ReportButton } from "@/components/report-button";
import { RoleIcon } from "@/components/role-icon";
import {
  getOtherParticipant,
  getThread,
  getThreadMessages,
  isBlocked,
  isParticipant,
  markThreadRead,
} from "@/lib/chat";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversation",
};

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const session = await requireSession();

  const thread = await getThread(threadId);
  if (!thread || !isParticipant(thread, session.userId)) {
    notFound();
  }

  const other = await getOtherParticipant(thread, session.userId);
  if (!other) notFound();

  const [messages, blocked] = await Promise.all([
    getThreadMessages(threadId, session.userId),
    isBlocked(session.userId, other.id),
  ]);

  // Clear the unread badge for this thread before rendering.
  await markThreadRead(threadId, session.userId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <header className="space-y-4 rounded-3xl glass shadow-water p-6">
        <Link href="/messages" className="text-base font-semibold text-brand hover:underline">
          ← All messages
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl bg-seaglass/25 text-brand"
              aria-hidden="true"
            >
              <RoleIcon role={other.role} />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">{other.name}</h1>
              <p className="text-base text-ink/70">
                {other.role === "river" ? "River · Older adult" : "Drop · Young person"} ·{" "}
                {other.ageBand}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <ReportButton targetType="user" targetId={other.id} />
            {!blocked ? <BlockButton threadId={threadId} name={other.name} /> : null}
          </div>
        </div>
      </header>

      <MessageThread
        threadId={threadId}
        other={other}
        viewerId={session.userId}
        initialMessages={messages}
        initialCanSend={!blocked && thread.status === "active"}
      />
    </div>
  );
}

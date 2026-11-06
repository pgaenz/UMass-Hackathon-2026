import Link from "next/link";

import { RoleIcon } from "@/components/role-icon";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, truncate } from "@/lib/format";
import type { ThreadSummary } from "@/lib/types";

function preview(summary: ThreadSummary, viewerId: string): string {
  if (!summary.lastMessage) return "No messages yet — say hello.";
  const prefix = summary.lastMessage.senderId === viewerId ? "You: " : "";
  return `${prefix}${truncate(summary.lastMessage.body, 80)}`;
}

/** Inbox rows. Rendering only — every value comes from the server. */
export function ThreadList({
  threads,
  viewerId,
}: {
  threads: ThreadSummary[];
  viewerId: string;
}) {
  return (
    <ul className="space-y-4">
      {threads.map((thread) => (
        <li key={thread.threadId}>
          <Link
            href={`/messages/${thread.threadId}`}
            className="lift flex items-center gap-4 rounded-2xl glass shadow-water p-5 hover:border-brand"
          >
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-seaglass/25 text-brand"
              aria-hidden="true"
            >
              <RoleIcon role={thread.other.role} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-semibold text-ink">{thread.other.name}</span>
                {thread.blocked ? <Badge className="bg-coral/20 text-coral">Closed</Badge> : null}
                {thread.unreadCount > 0 ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-brand px-2 text-sm font-bold text-white">
                    {thread.unreadCount}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-lg text-ink/70">
                {preview(thread, viewerId)}
              </span>
            </span>

            <time
              dateTime={thread.updatedAt}
              className="shrink-0 text-sm text-ink/80"
              suppressHydrationWarning
            >
              {formatRelativeTime(thread.updatedAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import type { Metadata } from "next";

import { ThreadList } from "@/components/chat/thread-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listThreadsForUser } from "@/lib/chat";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function MessagesPage() {
  const session = await requireSession();
  const threads = await listThreadsForUser(session.userId);

  return (
    <div
      className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10"
      data-tour="messages-page"
    >
      <PageHeader
        title="Messages"
        description="Private conversations with anyone in the community."
      >
        <ButtonLink href="/connect" variant="secondary" data-tour="connect-link">
          Find someone to connect with
        </ButtonLink>
      </PageHeader>

      {threads.length > 0 ? (
        <ThreadList threads={threads} viewerId={session.userId} />
      ) : (
        <EmptyState
          title="No conversations yet"
          description="Start with a River in the directory, or from any public profile."
        >
          <ButtonLink href="/connect">Browse Rivers</ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}

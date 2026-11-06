import type { Metadata } from "next";

import { ThreadList } from "@/components/chat/thread-list";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { listThreadsForUser } from "@/lib/chat";
import { getCurrentUser, requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Messages",
};

export default async function MessagesPage() {
  const session = await requireSession();
  const [threads, user] = await Promise.all([
    listThreadsForUser(session.userId),
    getCurrentUser(),
  ]);

  return (
    <div
      className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10"
      data-tour="messages-page"
    >
      <PageHeader
        title="Messages"
        description="Private conversations. Messages are checked for safety."
      >
        <ButtonLink href="/connect" variant="secondary" data-tour="connect-link">
          {user?.role === "drop" ? "Find a River" : "Find someone to connect with"}
        </ButtonLink>
      </PageHeader>

      {threads.length > 0 ? (
        <ThreadList threads={threads} viewerId={session.userId} />
      ) : (
        <EmptyState
          title={user?.role === "drop" ? "Find a River to talk with" : "No conversations yet"}
          description={
            user?.role === "drop"
              ? "Rivers are adults. You can message them privately, and messages are checked for safety."
              : "Start with a River in the directory, or from any public profile."
          }
        >
          <ButtonLink href="/connect">Find a River</ButtonLink>
        </EmptyState>
      )}
    </div>
  );
}

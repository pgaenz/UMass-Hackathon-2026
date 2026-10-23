import type { Metadata } from "next";

import {
  ConnectDirectory,
  type DirectoryPerson,
} from "@/components/chat/connect-directory";
import { PageHeader } from "@/components/ui/page-header";
import { getTopics } from "@/lib/questions";
import { requireSession } from "@/lib/session";
import { getUser, listUsers, toPublicUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Connect",
};

export default async function ConnectPage() {
  const session = await requireSession();
  const [me, users, topics] = await Promise.all([
    getUser(session.userId),
    listUsers(),
    getTopics(),
  ]);

  const myInterests = new Set(me?.interests ?? []);
  const people: DirectoryPerson[] = users
    .filter((user) => user.role === "river" && user.id !== session.userId)
    .map((user) => {
      const profile = toPublicUser(user);
      return {
        id: profile.id,
        name: profile.name,
        ageBand: profile.ageBand,
        bio: profile.bio,
        interests: profile.interests,
        sharedInterests: profile.interests.filter((interest) => myInterests.has(interest)),
      };
    })
    .sort(
      (a, b) =>
        b.sharedInterests.length - a.sharedInterests.length ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
      <PageHeader
        title="Connect"
        description="Rivers are the heart of HistorAI. Reach out to someone whose story you would like to know."
      />
      <ConnectDirectory people={people} topics={topics} />
    </div>
  );
}

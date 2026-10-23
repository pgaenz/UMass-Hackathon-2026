import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding-form";
import { getTopics } from "@/lib/questions";
import { getCurrentUser } from "@/lib/session";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your profile",
};

function isRole(value: string | undefined): value is Role {
  return value === "river" || value === "drop";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  if (!isRole(role)) redirect("/login");

  // Only bounce users that actually exist; a stale token must not block signup.
  const user = await getCurrentUser();
  if (user) redirect("/");

  const topics = await getTopics();
  const isRiver = role === "river";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-12">
      <Link href="/login" className="inline-block text-lg font-semibold text-brand hover:underline">
        ← Change your answer
      </Link>

      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          {isRiver ? "River · Older adult" : "Drop · Young person"}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Tell us about you
        </h1>
        <p className="text-xl text-ink/70">
          Your name and age are required. Everything else is optional.
        </p>
      </div>

      <OnboardingForm role={role} topics={topics} />
    </div>
  );
}

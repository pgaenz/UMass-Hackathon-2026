import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { VisitorButton } from "@/components/visitor-button";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

const ROLES = [
  {
    role: "river",
    title: "I'm a River",
    subtitle: "Older adult",
    description:
      "Share the stories and lessons of a lifetime. Answer questions from young people.",
    icon: "🌊",
    accent: "border-brand hover:bg-seaglass/25",
  },
  {
    role: "drop",
    title: "I'm a Drop",
    subtitle: "Young person",
    description:
      "Ask what you have always wondered, and learn from the people who lived it.",
    icon: "💧",
    accent: "border-seaglass hover:bg-seaglass/25",
  },
] as const;

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-6 py-14">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">HistorAI · When I was your age</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          How do you want to continue?
        </h1>
        <p className="mx-auto max-w-2xl text-xl text-ink/70">
          Water is our metaphor for wisdom. A River has a lifetime of it; a Drop is
          here to learn.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {ROLES.map((option) => (
          <Link
            key={option.role}
            href={`/onboarding?role=${option.role}`}
            className={`ripple flex flex-col gap-4 rounded-3xl border-2 bg-white/60 p-7 shadow-water backdrop-blur transition ${option.accent}`}
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-seaglass/25 text-4xl" aria-hidden="true">
              {option.icon}
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold uppercase tracking-wide text-brand">
                {option.subtitle}
              </span>
              <span className="block text-2xl font-bold text-ink">{option.title}</span>
            </span>
            <span className="text-lg text-ink/70">{option.description}</span>
            <span className="mt-auto text-lg font-semibold text-brand">Continue →</span>
          </Link>
        ))}
      </div>

      <div className="space-y-4 border-t border-seaglass/40 pt-8 text-center">
        <p className="text-base text-ink/70">
          No password needed for this demo. Visitors can read every story and question,
          but cannot ask or answer.
        </p>
        <VisitorButton />
      </div>
    </div>
  );
}

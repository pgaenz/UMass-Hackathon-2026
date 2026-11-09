import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { RoleIcon } from "@/components/role-icon";
import { VisitorButton } from "@/components/visitor-button";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

const ROLES = [
  {
    role: "river",
    title: "I'm a River",
    subtitle: "Older adult · ages 31+",
    description:
      "Share the stories and lessons of a lifetime. Answer questions from young people.",
    accent: "border-brand hover:bg-seaglass/25",
  },
  {
    role: "drop",
    title: "I'm a Drop",
    subtitle: "Young person · ages 16–30",
    description:
      "Ask what you have always wondered, and learn from the people who lived it.",
    accent: "border-seaglass hover:bg-seaglass/25",
  },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  // Check the actual session, not just the cookie: a stale cookie can outlive
  // its session after a data reset or logout elsewhere.
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { reset } = await searchParams;
  const notice =
    reset === "1" ? "Your password was reset. Sign in with your new password." : null;

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

      <section
        className="mx-auto w-full max-w-md space-y-4 rounded-3xl border-2 border-seaglass/60 bg-white/60 p-6 text-left shadow-water backdrop-blur"
        data-tour="sign-in"
      >
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-ink">Sign in</h2>
          <p className="text-lg text-ink/70">
            Use the email and password for your account.
          </p>
        </div>
        <LoginForm notice={notice} />
      </section>

      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-ink">New here?</h2>
          <p className="text-lg text-ink/70">Choose a role to create your account.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2" data-tour="role-choice">
          {ROLES.map((option) => (
            <Link
              key={option.role}
              href={`/onboarding?role=${option.role}`}
              data-tour={option.role === "river" ? "role-river" : "role-drop"}
              className={`ripple flex flex-col gap-4 rounded-3xl border-2 bg-white/60 p-7 shadow-water backdrop-blur transition ${option.accent}`}
            >
              <span
                className="grid h-16 w-16 place-items-center rounded-2xl bg-seaglass/25 text-brand"
                aria-hidden="true"
              >
                <RoleIcon role={option.role} />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-semibold uppercase tracking-wide text-brand">
                  {option.subtitle}
                </span>
                <span className="block text-2xl font-bold text-ink">{option.title}</span>
              </span>
              <span className="text-lg text-ink/70">{option.description}</span>
              <span className="mt-auto text-lg font-semibold text-brand">Create account →</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-seaglass/40 pt-8 text-center">
        <p className="text-base text-ink/70">
          Visitors can read every story and question, but cannot ask or answer.
        </p>
        <VisitorButton />
      </div>
    </div>
  );
}

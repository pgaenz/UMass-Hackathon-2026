import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" && token.trim() ? token : null;

  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-6 py-14">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          HistorAI · When I was your age
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Choose a new password
        </h1>
      </div>

      <section className="space-y-6 rounded-3xl border-2 border-seaglass/60 bg-white/60 p-6 text-left shadow-water backdrop-blur">
        {value ? (
          <ResetPasswordForm token={value} />
        ) : (
          <div className="space-y-4">
            <p
              role="alert"
              className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean"
            >
              This reset link is invalid or has expired.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block text-lg font-semibold text-brand underline-offset-4 hover:underline"
            >
              Request a new link →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

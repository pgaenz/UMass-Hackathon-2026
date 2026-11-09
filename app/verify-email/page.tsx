import type { Metadata } from "next";

import { VerifyEmailPanel } from "@/components/verify-email-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-6 py-14">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          HistorAI · When I was your age
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Verify your email
        </h1>
      </div>

      <section className="space-y-6 rounded-3xl border-2 border-seaglass/60 bg-white/60 p-6 text-left shadow-water backdrop-blur">
        <VerifyEmailPanel token={value} />
      </section>
    </div>
  );
}

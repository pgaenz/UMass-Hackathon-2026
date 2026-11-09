import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-6 py-14">
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          HistorAI · When I was your age
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Reset your password
        </h1>
        <p className="text-xl text-ink/70">
          Enter your email and we will send a link to choose a new password.
        </p>
      </div>

      <section className="space-y-6 rounded-3xl border-2 border-seaglass/60 bg-white/60 p-6 text-left shadow-water backdrop-blur">
        <ForgotPasswordForm />
      </section>

      <p className="text-center text-lg text-ink/70">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

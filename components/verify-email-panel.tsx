"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ButtonLink } from "@/components/ui/button";

type State = "verifying" | "done" | "error";

/**
 * Verifies an email token exactly once. The token is single-use, so the POST
 * runs from an effect guarded against React's development double-invoke rather
 * than during server render.
 */
export function VerifyEmailPanel({ token }: { token: string }) {
  const [state, setState] = useState<State>(token ? "verifying" : "error");
  const [error, setError] = useState(
    token ? "" : "This verification link is missing its token.",
  );
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? "We could not verify this link.");
        if (!cancelled) setState("done");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "verifying") {
    return (
      <p role="status" className="text-lg text-ink/70">
        Verifying your email…
      </p>
    );
  }

  if (state === "done") {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-lg bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean"
        >
          Your email is verified. Thank you for confirming it.
        </p>
        <ButtonLink href="/" size="lg">
          Go to HistorAI
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
        {error}
      </p>
      <p className="text-lg text-ink/70">
        Sign in and choose <strong>Resend verification email</strong> on your profile if you
        need a new link.
      </p>
      <Link
        href="/login"
        className="inline-block text-lg font-semibold text-brand underline-offset-4 hover:underline"
      >
        ← Back to sign in
      </Link>
    </div>
  );
}

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Shows the signed-in owner whether their email is verified and offers a fresh
 * link. Never renders anything for an account without a credential.
 */
export function VerifyEmailStatus({ verified }: { verified: boolean }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function resend() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/verify/resend", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not send the email.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  if (verified) {
    return (
      <p role="status" className="text-lg text-ocean">
        Your email address is verified.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-lg text-ink/70">
        Your email address is not verified yet. Verify it so you can recover your account if
        you forget your password.
      </p>

      {sent ? (
        <p role="status" className="rounded-lg bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean">
          If your email still needs verifying, a new link is on its way. It expires in 24
          hours.
        </p>
      ) : (
        <Button type="button" variant="secondary" size="lg" onClick={resend} disabled={sending}>
          {sending ? "Sending…" : "Resend verification email"}
        </Button>
      )}

      {error ? (
        <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
          {error}
        </p>
      ) : null}
    </div>
  );
}

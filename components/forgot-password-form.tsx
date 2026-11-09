"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";

/**
 * Requests a password-reset link. The API answers identically whether or not
 * the email is registered, so the copy here never hints at account existence.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "We could not send the reset email.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-lg bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean"
        >
          If an account exists for that email, we have sent a reset link. Check your inbox
          and spam folder. The link works once and expires in one hour.
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="forgot-email" className="text-lg font-semibold text-ink">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className={inputClass}
          placeholder="you@example.com"
        />
        <p className="text-base text-ink/70">
          Enter the email you used to create your account.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

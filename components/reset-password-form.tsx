"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";

const MIN_PASSWORD = 8;

/** Consumes a reset token and sets a new password. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Please use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not reset your password.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-lg bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean"
        >
          Your password has been reset. Any other devices have been signed out.
        </p>
        <ButtonLink href="/login?reset=1" size="lg">
          Sign in with your new password
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="reset-password" className="text-lg font-semibold text-ink">
          New password
        </label>
        <input
          id="reset-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          aria-describedby="reset-password-hint"
          className={inputClass}
          placeholder="At least 8 characters"
        />
        <p id="reset-password-hint" className="text-base text-ink/70">
          Use at least {MIN_PASSWORD} characters.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="reset-confirm" className="text-lg font-semibold text-ink">
          Confirm new password
        </label>
        <input
          id="reset-confirm"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
          placeholder="Type it again"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

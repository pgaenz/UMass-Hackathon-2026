"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";

const MIN_PASSWORD = 8;

/**
 * Changes the signed-in user's password. The API revokes other devices but
 * re-issues a session for this one, so the person stays signed in here.
 */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<{ kind: "error" | "success"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!current) {
      setNotice({ kind: "error", message: "Please enter your current password." });
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setNotice({
        kind: "error",
        message: `Please use at least ${MIN_PASSWORD} characters for your new password.`,
      });
      return;
    }
    if (next !== confirm) {
      setNotice({ kind: "error", message: "Those new passwords do not match." });
      return;
    }
    if (next === current) {
      setNotice({ kind: "error", message: "Please choose a password you have not used here." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not change your password.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({
        kind: "success",
        message: "Your password is updated. Other devices have been signed out.",
      });
    } catch (err) {
      setNotice({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="current-password" className="text-lg font-semibold text-ink">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="new-password" className="text-lg font-semibold text-ink">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          aria-describedby="new-password-hint"
          className={inputClass}
        />
        <p id="new-password-hint" className="text-base text-ink/70">
          Use at least {MIN_PASSWORD} characters.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="text-lg font-semibold text-ink">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error"
              ? "rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean"
              : "rounded-lg bg-seaglass/40 px-4 py-3 text-lg font-medium text-ocean"
          }
        >
          {notice.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={saving}>
        {saving ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/lib/types";

/**
 * Passwordless demo sign-in: pick an existing profile and continue as that user
 * (see plan/UX-FIXES-2.md §7). No password, no email — clearly a demo affordance.
 */
export function ExistingAccountPicker({ users }: { users: PublicUser[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (users.length === 0) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError("Pick a profile to continue.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not sign you in.");

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="existing-account" className="text-lg font-semibold text-ink">
          Choose your profile
        </label>
        <select
          id="existing-account"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="min-h-12 w-full rounded-xl border-2 border-seaglass bg-white/80 px-4 text-lg text-ink focus:border-brand focus:outline-none"
        >
          <option value="">Select a name…</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.role === "river" ? "River" : "Drop"} · {user.name} · {user.ageBand}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" size="lg" disabled={busy}>
        {busy ? "Signing in…" : "Continue as this profile"}
      </Button>
    </form>
  );
}

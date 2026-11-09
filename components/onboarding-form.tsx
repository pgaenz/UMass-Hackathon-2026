"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ageRangeForRole, ageRequirement, isValidAgeForRole } from "@/lib/age";
import { cn } from "@/lib/cn";
import type { Role, Topic } from "@/lib/types";

export function OnboardingForm({ role, topics }: { role: Role; topics: Topic[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const ageRange = ageRangeForRole(role);

  function toggleInterest(topicId: string) {
    setInterests((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Please use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords do not match.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    const ageNumber = Number.parseInt(age, 10);
    if (!isValidAgeForRole(ageNumber, role)) {
      setError(ageRequirement(role));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name,
          age: ageNumber,
          bio,
          interests,
          email: email.trim(),
          password,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not create your account.");

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl glass shadow-water p-6 shadow-sm"
    >
      <div className="space-y-2">
        <label htmlFor="profile-email" className="text-lg font-semibold text-ink">
          Email <span className="text-brand">*</span>
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          placeholder="you@example.com"
        />
        <p className="text-base text-ink/70">
          We use your email to sign you in. It is never shown on your public profile.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="profile-password" className="text-lg font-semibold text-ink">
          Password <span className="text-brand">*</span>
        </label>
        <input
          id="profile-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          aria-describedby="profile-password-hint"
          className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          placeholder="At least 8 characters"
        />
        <p id="profile-password-hint" className="text-base text-ink/70">
          Use at least 8 characters. You can change it later.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="profile-confirm-password" className="text-lg font-semibold text-ink">
          Confirm password <span className="text-brand">*</span>
        </label>
        <input
          id="profile-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
          className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          placeholder="Type it again"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="profile-name" className="text-lg font-semibold text-ink">
          Your name <span className="text-brand">*</span>
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          autoComplete="name"
          required
          className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          placeholder="e.g. Ruth Alvarez"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="profile-age" className="text-lg font-semibold text-ink">
          Your age <span className="text-brand">*</span>
        </label>
        <input
          id="profile-age"
          type="number"
          value={age}
          onChange={(event) => setAge(event.target.value)}
          min={ageRange.min}
          max={ageRange.max}
          inputMode="numeric"
          required
          aria-describedby="profile-age-hint"
          className="w-full max-w-40 rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          placeholder={role === "drop" ? "e.g. 22" : "e.g. 78"}
        />
        <p id="profile-age-hint" className="text-base text-ink/70">
          {role === "drop"
            ? `Drops must be between ${ageRange.min} and ${ageRange.max} years old. `
            : ""}
          Only an age range (like &ldquo;75+&rdquo;) is ever shown on your public profile.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="profile-bio" className="text-lg font-semibold text-ink">
          Short bio <span className="font-normal text-ink/70">(optional)</span>
        </label>
        <textarea
          id="profile-bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          maxLength={300}
          className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink placeholder:text-ink/75 focus:border-brand"
          placeholder="A sentence about you."
          aria-describedby="profile-bio-hint"
        />
        <p id="profile-bio-hint" className="text-base text-ink/70">
          Your bio and interests are public. Please do not include private details.
        </p>
      </div>

      {topics.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-ink">
            Interests <span className="font-normal text-ink/70">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => {
              const active = interests.includes(topic.id);
              return (
                <label
                  key={topic.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-lg font-medium transition",
                    active
                      ? "border-brand bg-seaglass/25 text-ocean"
                      : "border-2 border-seaglass bg-white/60 backdrop-blur text-ink hover:border-brand",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleInterest(topic.id)}
                    className="h-5 w-5"
                  />
                  {topic.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-brand/15 px-4 py-3 text-lg font-medium text-ocean">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}

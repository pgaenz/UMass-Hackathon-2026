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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name, age: ageNumber, bio, interests }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not create your profile.");

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
        />
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
        {submitting ? "Creating your profile…" : "Continue"}
      </Button>
    </form>
  );
}

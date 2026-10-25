"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ageRangeForRole, ageRequirement, isValidAgeForRole } from "@/lib/age";
import { cn } from "@/lib/cn";
import type { Topic, User } from "@/lib/types";

export function ProfileForm({ user, topics }: { user: User; topics: Topic[] }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [age, setAge] = useState(String(user.age));
  const [bio, setBio] = useState(user.bio);
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const ageRange = ageRangeForRole(user.role);

  function toggleInterest(topicId: string) {
    setInterests((current) =>
      current.includes(topicId)
        ? current.filter((id) => id !== topicId)
        : [...current, topicId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!name.trim()) {
      setNotice({ kind: "error", message: "Please enter your name." });
      return;
    }
    const ageNumber = Number.parseInt(age, 10);
    if (!isValidAgeForRole(ageNumber, user.role)) {
      setNotice({ kind: "error", message: ageRequirement(user.role) });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age: ageNumber, bio, interests }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        notice?: string;
        user?: { bio?: string };
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not save your profile.");
      if (typeof data?.user?.bio === "string") setBio(data.user.bio);
      setNotice({ kind: "success", message: data?.notice ?? "Your profile is saved." });
      router.refresh();
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
    <form
      onSubmit={handleSubmit}
      data-tour="profile-form"
      className="space-y-6 rounded-2xl glass shadow-water p-6 shadow-sm"
    >
      <h2 className="text-2xl font-semibold text-ink">Edit your profile</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="edit-name" className="text-lg font-semibold text-ink">
            Name
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink focus:border-brand"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-age" className="text-lg font-semibold text-ink">
            Age
          </label>
          <input
            id="edit-age"
            type="number"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            min={ageRange.min}
            max={ageRange.max}
            inputMode="numeric"
            aria-describedby="edit-age-hint"
            className="w-full max-w-40 rounded-xl border-2 border-seaglass p-4 text-lg text-ink focus:border-brand"
          />
          <p id="edit-age-hint" className="text-base text-ink/70">
            {user.role === "drop"
              ? `Drops must be between ${ageRange.min} and ${ageRange.max} years old.`
              : `Only an age range is shown publicly.`}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="edit-bio" className="text-lg font-semibold text-ink">
          Short bio <span className="font-normal text-ink/70">(optional)</span>
        </label>
        <textarea
          id="edit-bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          maxLength={300}
          className="w-full rounded-xl border-2 border-seaglass p-4 text-lg text-ink focus:border-brand"
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

      {notice ? (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg px-4 py-3 text-lg font-medium",
            notice.kind === "error"
              ? "bg-brand/15 text-ocean"
              : "bg-seaglass/40 text-ocean",
          )}
        >
          {notice.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={saving}>
        {saving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

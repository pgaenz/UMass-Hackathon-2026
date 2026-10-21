"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
    if (!Number.isInteger(ageNumber) || ageNumber < 13 || ageNumber > 120) {
      setNotice({ kind: "error", message: "Please enter an age of 13 or older." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age: ageNumber, bio, interests }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "We could not save your profile.");
      setNotice({ kind: "success", message: "Your profile is saved." });
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
      className="space-y-6 rounded-2xl border border-orange-100 bg-surface p-6 shadow-sm"
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
            className="w-full rounded-xl border-2 border-orange-200 p-4 text-lg text-ink focus:border-brand"
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
            min={13}
            max={120}
            inputMode="numeric"
            className="w-full max-w-40 rounded-xl border-2 border-orange-200 p-4 text-lg text-ink focus:border-brand"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="edit-bio" className="text-lg font-semibold text-ink">
          Short bio <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="edit-bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={3}
          maxLength={300}
          className="w-full rounded-xl border-2 border-orange-200 p-4 text-lg text-ink focus:border-brand"
        />
      </div>

      {topics.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-ink">
            Interests <span className="font-normal text-gray-500">(optional)</span>
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
                      ? "border-brand bg-orange-50 text-orange-700"
                      : "border-orange-200 bg-surface text-ink hover:border-brand",
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
              ? "bg-red-50 text-red-800"
              : "bg-green-50 text-green-900",
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

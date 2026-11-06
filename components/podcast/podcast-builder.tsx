"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PodcastPlayer } from "@/components/podcast/podcast-player";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  PODCAST_MINUTES,
  type PodcastMinutes,
  type PodcastMode,
  type PodcastPlan,
} from "@/lib/podcast-types";
import type { Topic } from "@/lib/types";

function minutesLabel(value: number): string {
  return Number.isInteger(value) ? `${value} min` : `${value.toFixed(1)} min`;
}

export function PodcastBuilder({
  topics,
  defaultTopics,
  signedIn,
  libraryMinutes,
}: {
  topics: Topic[];
  defaultTopics: string[];
  signedIn: boolean;
  libraryMinutes: number;
}) {
  const knownTopics = new Set(topics.map((topic) => topic.id));
  const initialTopics = defaultTopics.filter((id) => knownTopics.has(id));

  const [mode, setMode] = useState<PodcastMode>(
    initialTopics.length > 0 ? "interests" : "random",
  );
  const [selected, setSelected] = useState<string[]>(initialTopics);
  const [minutes, setMinutes] = useState<PodcastMinutes>(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PodcastPlan | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plan) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [plan]);

  function toggleTopic(id: string) {
    setMode("interests");
    setSelected((current) =>
      current.includes(id) ? current.filter((topic) => topic !== id) : [...current, id],
    );
  }

  async function generate() {
    if (!signedIn) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/podcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: selected, mode, minutes }),
      });
      const data = (await res.json().catch(() => null)) as
        | { plan?: PodcastPlan; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "We could not build that episode.");
      }
      if (!data?.plan) throw new Error("The podcast plan was empty.");
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-6 rounded-3xl border border-white/70 bg-white/55 p-6 shadow-water backdrop-blur sm:p-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            Build your episode
          </h2>
          <p className="text-lg text-ink/70">
            Pick interests yourself, or let Random choose a mix from across the community.
          </p>
        </div>

        {!signedIn ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sunset/50 bg-sunset/15 px-5 py-4">
            <p className="flex-1 text-lg text-ink/80">
              Anyone can explore this page. Sign in to create your own episode.
            </p>
            <ButtonLink href="/login" size="md">
              Sign in to create
            </ButtonLink>
          </div>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-ink">Interests</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={mode === "random"}
              onClick={() => setMode("random")}
              className={cn(
                "ripple inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-base font-semibold transition",
                mode === "random"
                  ? "border-brand bg-brand text-white shadow-water"
                  : "border-seaglass bg-white/60 text-ink hover:border-brand",
              )}
            >
              <span aria-hidden="true">🎲</span>
              Random mix
            </button>
            {topics.map((topic) => {
              const active = mode === "interests" && selected.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTopic(topic.id)}
                  className={cn(
                    "ripple inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-base font-medium transition",
                    active
                      ? "border-brand bg-seaglass/35 text-ocean"
                      : "border-seaglass bg-white/60 text-ink hover:border-brand",
                  )}
                >
                  {active ? <span aria-hidden="true">✓</span> : null}
                  {topic.label}
                </button>
              );
            })}
          </div>
          <p className="text-base text-ink/70" aria-live="polite">
            {mode === "random"
              ? "Random selects stories from across every published topic."
              : selected.length === 0
                ? "Choose one or more interests, or switch to Random mix."
                : `${selected.length} ${
                    selected.length === 1 ? "interest" : "interests"
                  } selected.`}
          </p>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold text-ink">Episode length</legend>
          <div className="flex flex-wrap gap-2">
            {PODCAST_MINUTES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={minutes === option}
                onClick={() => setMinutes(option)}
                className={cn(
                  "ripple inline-flex min-h-12 min-w-24 items-center justify-center rounded-xl border-2 px-5 text-lg font-semibold transition",
                  minutes === option
                    ? "border-brand bg-brand text-white shadow-water"
                    : "border-seaglass bg-white/60 text-ink hover:border-brand",
                )}
              >
                {option} min
              </button>
            ))}
          </div>
          <p className="text-base text-ink/70">
            The current story library holds about {libraryMinutes} minutes of material. The host
            adds introductions, reflections, and connections to reach your chosen length.
          </p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            onClick={generate}
            disabled={loading || !signedIn || (mode === "interests" && selected.length === 0)}
          >
            {loading ? "Building your episode…" : "Create podcast"}
          </Button>
          {loading ? (
            <p className="text-base font-medium text-brand" role="status">
              Selecting stories and writing the host narration. This can take up to a minute.
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-coral/15 px-4 py-3 text-lg font-medium text-ocean">
            {error}
          </p>
        ) : null}
      </section>

      <div aria-live="polite">
        {plan ? (
          <div ref={resultRef} className="space-y-6 scroll-mt-24">
            <section className="space-y-4 rounded-3xl border border-white/70 bg-white/65 p-6 shadow-water backdrop-blur sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                    Your episode
                  </p>
                  <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink">
                    {plan.title}
                  </h2>
                  <p className="max-w-2xl text-lg text-ink/75">{plan.summary}</p>
                </div>
                <Button variant="secondary" onClick={() => setPlan(null)}>
                  Start over
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-base text-ink/70">
                <span className="rounded-full bg-brand/15 px-3 py-1 font-semibold text-ocean">
                  {plan.targetMinutes} minute target
                </span>
                <span className="rounded-full bg-seaglass/30 px-3 py-1">
                  {minutesLabel(plan.estimatedMinutes)} estimated
                </span>
                <span className="rounded-full bg-seaglass/30 px-3 py-1">
                  {plan.segments.length} {plan.segments.length === 1 ? "story" : "stories"}
                </span>
                <span className="rounded-full bg-seaglass/30 px-3 py-1">
                  {plan.mode === "random"
                    ? "Random mix"
                    : plan.interestLabels.join(", ") || "Selected interests"}
                </span>
              </div>

              {plan.estimatedMinutes < plan.targetMinutes - 1 ? (
                <p className="rounded-xl border border-sunset/40 bg-sunset/15 px-4 py-3 text-base text-ink/80">
                  The current library and host narration come in at about{" "}
                  {minutesLabel(plan.estimatedMinutes)}. As more Rivers publish stories, episodes
                  will get closer to longer targets.
                </p>
              ) : null}

              <PodcastPlayer plan={plan} />

              {!plan.aiGenerated ? (
                <p className="text-base text-ink/70">
                  The writing service was unavailable, so this episode uses the standard host
                  script.
                </p>
              ) : null}
            </section>

            <section aria-labelledby="podcast-chapters" className="space-y-4">
              <h3 id="podcast-chapters" className="text-2xl font-bold tracking-tight text-ink">
                Stories in this episode
              </h3>
              <ol className="space-y-4">
                {plan.segments.map((segment, index) => (
                  <li
                    key={segment.storyId}
                    className="rounded-2xl glass shadow-water p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ocean text-lg font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h4 className="text-xl font-semibold leading-snug text-ink">
                            {segment.title}
                          </h4>
                          <span className="text-base text-ink/70">
                            {minutesLabel(segment.storyMinutes)}
                          </span>
                        </div>
                        <p className="text-base text-ink/70">
                          {segment.author ? (
                            <>
                              Shared by{" "}
                              <Link
                                href={segment.author.profileHref}
                                className="font-semibold text-brand hover:underline"
                              >
                                {segment.author.name}
                              </Link>{" "}
                              · River · {segment.author.ageBand}
                            </>
                          ) : (
                            "Shared by the HistorAI community"
                          )}
                        </p>
                        {segment.topics.length > 0 ? (
                          <ul className="flex flex-wrap gap-2" aria-label="Topics">
                            {segment.topics.map((topic) => (
                              <li
                                key={topic.id}
                                className="rounded-full bg-seaglass/30 px-2.5 py-1 text-sm font-medium text-ocean"
                              >
                                {topic.label}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        <p className="text-base leading-relaxed text-ink/75">
                          {segment.hostLeadIn}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <details className="rounded-2xl border border-seaglass/50 bg-white/55 p-5 shadow-water">
              <summary className="cursor-pointer text-xl font-semibold text-ink">
                Read the full episode script
              </summary>
              <div className="mt-5 space-y-6 text-lg leading-relaxed text-ink/80">
                <section className="space-y-2">
                  <h4 className="text-lg font-bold text-ink">Host introduction</h4>
                  <p className="whitespace-pre-wrap">{plan.intro}</p>
                </section>
                {plan.segments.map((segment, index) => (
                  <section key={segment.storyId} className="space-y-2 border-t border-seaglass/40 pt-5">
                    <h4 className="text-lg font-bold text-ink">
                      {index + 1}. {segment.title}
                    </h4>
                    <p className="whitespace-pre-wrap">{segment.hostLeadIn}</p>
                    <div className="rounded-xl bg-white/60 p-4">
                      <p className="whitespace-pre-wrap">{segment.storyText}</p>
                    </div>
                    <p className="whitespace-pre-wrap">{segment.hostReflection}</p>
                  </section>
                ))}
                <section className="space-y-2 border-t border-seaglass/40 pt-5">
                  <h4 className="text-lg font-bold text-ink">Host closing</h4>
                  <p className="whitespace-pre-wrap">{plan.outro}</p>
                </section>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </div>
  );
}

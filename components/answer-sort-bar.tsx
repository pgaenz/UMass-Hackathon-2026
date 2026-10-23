import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import type { Topic } from "@/lib/types";

type Sort = "newest" | "likes" | "topic";

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "likes", label: "Most liked" },
  { id: "topic", label: "Topic (A–Z)" },
];

/**
 * URL-driven sort/topic controls for answer lists. Server-rendered and
 * shareable, mirroring QuestionFilterBar (see plan/UX-FIXES.md §5).
 */
export function AnswerSortBar({
  topics,
  activeTopic,
  activeSort,
  basePath,
}: {
  topics: Topic[];
  activeTopic?: string | null;
  activeSort?: string;
  basePath: string;
}) {
  const sort: Sort = SORTS.find((item) => item.id === activeSort)?.id ?? "newest";

  function href(next: { topic?: string | null; sort?: string }): string {
    const params = new URLSearchParams();
    const topic = next.topic === null ? null : (next.topic ?? activeTopic);
    const nextSort = next.sort ?? sort;
    if (topic) params.set("topic", topic);
    if (nextSort && nextSort !== "newest") params.set("sort", nextSort);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div className="space-y-4">
      {topics.length > 0 ? (
        <div>
          <h2 className="text-lg font-semibold text-ink">Filter by topic</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <FilterLink href={href({ topic: null })} active={!activeTopic}>
                All topics
              </FilterLink>
            </li>
            {topics.map((topic) => (
              <li key={topic.id}>
                <FilterLink href={href({ topic: topic.id })} active={activeTopic === topic.id}>
                  {topic.label}
                </FilterLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-ink">Sort</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SORTS.map((option) => (
            <li key={option.id}>
              <FilterLink href={href({ sort: option.id })} active={sort === option.id}>
                {option.label}
              </FilterLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ripple inline-flex min-h-10 items-center rounded-full px-4 py-1.5 text-base font-medium transition",
        active
          ? "border-2 border-brand bg-brand text-white shadow-water"
          : "border-2 border-seaglass bg-white/60 text-ink backdrop-blur hover:border-brand hover:bg-white/80",
      )}
    >
      {children}
    </Link>
  );
}

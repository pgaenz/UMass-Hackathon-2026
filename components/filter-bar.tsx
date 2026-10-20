import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/cn";
import type { Topic } from "@/lib/types";

type Sort = "popular" | "newest" | "unanswered";

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: "popular", label: "Most popular" },
  { id: "newest", label: "Newest" },
  { id: "unanswered", label: "Unanswered" },
];

export function QuestionFilterBar({
  topics,
  activeTopic,
  activeSort,
}: {
  topics: Topic[];
  activeTopic?: string;
  activeSort?: string;
}) {
  const sort: Sort = (SORTS.find((item) => item.id === activeSort)?.id ?? "popular") as Sort;

  function href(next: { topic?: string | null; sort?: string }): string {
    const params = new URLSearchParams();
    const topic = next.topic === null ? null : (next.topic ?? activeTopic);
    const nextSort = next.sort ?? sort;
    if (topic) params.set("topic", topic);
    if (nextSort) params.set("sort", nextSort);
    const query = params.toString();
    return query ? `/questions?${query}` : "/questions";
  }

  return (
    <div className="space-y-4">
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
        "inline-flex min-h-10 items-center rounded-full border-2 px-4 py-1.5 text-base font-medium transition",
        active
          ? "border-brand bg-brand text-white"
          : "border-orange-200 bg-surface text-ink hover:border-brand hover:bg-orange-50",
      )}
    >
      {children}
    </Link>
  );
}

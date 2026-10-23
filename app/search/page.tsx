import type { Metadata } from "next";
import Link from "next/link";

import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { search, type SearchKind, type SearchResult } from "@/lib/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
};

const GROUPS: Array<{ kind: SearchKind; heading: string; icon: string }> = [
  { kind: "question", heading: "Questions", icon: "❓" },
  { kind: "story", heading: "Stories", icon: "📖" },
  { kind: "user", heading: "People", icon: "👤" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = await search(query);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10">
      <PageHeader
        title="Search"
        description="Find questions, stories, and people across HistorAI."
      />

      <form action="/search" method="get" role="search" className="flex flex-wrap gap-3">
        <label htmlFor="search-input" className="sr-only">
          Search HistorAI
        </label>
        <input
          id="search-input"
          name="q"
          type="search"
          defaultValue={query}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- a search page should focus its input
          autoFocus
          placeholder="Try “first job”, “travel”, or a name"
          className="min-h-12 flex-1 rounded-xl border-2 border-seaglass bg-white/70 px-4 text-lg text-ink placeholder:text-ink/60 focus:border-brand focus:outline-none"
        />
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      {query.length < 2 ? (
        <p className="text-lg text-ink/70">
          Type at least two characters to search questions, stories, and people.
        </p>
      ) : results.length === 0 ? (
        <EmptyState
          title={`No results for “${query}”`}
          description="Try a different word, or browse the questions the community has asked."
        >
          <ButtonLink href="/questions">Browse questions</ButtonLink>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <p className="text-lg text-ink/70" aria-live="polite">
            {results.length} {results.length === 1 ? "result" : "results"} for “{query}”
          </p>

          {GROUPS.map((group) => {
            const items = results.filter((result) => result.kind === group.kind);
            if (items.length === 0) return null;
            return (
              <section key={group.kind} aria-labelledby={`results-${group.kind}`} className="space-y-3">
                <h2
                  id={`results-${group.kind}`}
                  className="text-xl font-bold tracking-tight text-ink"
                >
                  <span aria-hidden="true">{group.icon} </span>
                  {group.heading}
                </h2>
                <ul className="space-y-3">
                  {items.map((result) => (
                    <ResultRow key={`${result.kind}-${result.id}`} result={result} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultRow({ result }: { result: SearchResult }) {
  return (
    <li>
      <Link
        href={result.href}
        className="lift block rounded-2xl glass shadow-water p-4 transition hover:border-brand"
      >
        <span className="block text-lg font-semibold leading-snug text-ink">
          {result.title}
        </span>
        {result.snippet ? (
          <span className="mt-1 block text-base text-ink/70">{result.snippet}</span>
        ) : null}
      </Link>
    </li>
  );
}

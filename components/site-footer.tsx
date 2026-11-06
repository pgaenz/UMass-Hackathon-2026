import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/60 bg-white/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-base text-ink/70 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="font-semibold text-ink">HistorAI — When I was your age</p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <p>Youth drops joining elder rivers, for a less lonely world.</p>
          <Link
            href="/help"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Help &amp; FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
}

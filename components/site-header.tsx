import Link from "next/link";

const navItems = [
  { href: "/questions", label: "Questions" },
  { href: "/senior", label: "Answer" },
  { href: "/youth", label: "Read" },
];

/**
 * Shared top navigation. In the MVP the "role" is chosen by route:
 * there is no auth, so the shell simply exposes both experiences.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tight text-slate-900">
          HistorAI
        </Link>
        <nav aria-label="Primary">
          <ul className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-lg font-medium text-slate-700 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

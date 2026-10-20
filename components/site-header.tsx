"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/questions", label: "Questions" },
  { href: "/senior", label: "Answer" },
  { href: "/youth", label: "Read" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared top navigation: brand left, primary links center, search + profile right.
 * The active link is highlighted from the current route.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-base font-bold text-white">
            H
          </span>
          HistorAI
        </Link>

        <nav aria-label="Primary">
          <ul className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "inline-flex min-h-10 items-center rounded-xl bg-orange-100 px-4 text-sm font-semibold text-brand"
                        : "inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-medium text-ink hover:bg-orange-50"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Search"
            className="grid h-10 w-10 place-items-center rounded-xl border border-orange-100 bg-canvas text-ink transition hover:bg-orange-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Your profile"
            className="grid h-10 w-10 place-items-center rounded-xl border border-orange-100 bg-canvas text-ink transition hover:bg-orange-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

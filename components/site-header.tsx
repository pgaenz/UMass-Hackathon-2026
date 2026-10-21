"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import type { Role } from "@/lib/types";

export interface HeaderUser {
  id: string;
  name: string;
  role: Role;
}

function navItemsFor(user: HeaderUser | null) {
  return [
    { href: "/", label: "Home" },
    { href: "/questions", label: "Questions" },
    { href: "/youth", label: "Read" },
    ...(user?.role === "river" ? [{ href: "/senior", label: "Answer" }] : []),
  ];
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shared top navigation: brand left, primary links center, search + profile right.
 * The active link is highlighted from the current route. Signed-in users see
 * their name and a profile link; the "Answer" link only appears for Rivers.
 */
export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const navItems = navItemsFor(user);

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

          {user ? (
            <>
              <Link
                href="/profile"
                className="flex min-h-10 items-center gap-2 rounded-xl border border-orange-100 bg-canvas px-3 text-sm font-semibold text-ink transition hover:bg-orange-50"
                title={`${user.name} · ${user.role === "river" ? "River" : "Drop"}`}
              >
                <span aria-hidden="true">{user.role === "river" ? "🌊" : "💧"}</span>
                <span className="max-w-32 truncate">{user.name}</span>
              </Link>
              <LogoutButton compact />
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

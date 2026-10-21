"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { TextSizeToggle } from "@/components/text-size-toggle";
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
 * Shared top navigation: brand left, primary links center, text-size + profile
 * right. Sticks to the top through deep scrolling. The active link is
 * highlighted from the current route; "Answer" only appears for Rivers.
 */
export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const navItems = navItemsFor(user);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ocean/95 text-white shadow-water backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link
          href="/"
          className="ripple flex items-center gap-2 rounded-xl text-xl font-bold tracking-tight text-white"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sunset text-base font-bold text-ocean">
            H
          </span>
          <span className="flex flex-col leading-tight">
            <span>HistorAI</span>
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-seaglass">
              When I was your age
            </span>
          </span>
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
                        ? "ripple inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white"
                        : "ripple inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <TextSizeToggle />

          <button
            type="button"
            aria-label="Search"
            className="ripple grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
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
                className="ripple flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20"
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
              className="ripple inline-flex min-h-10 items-center rounded-xl bg-sunset px-4 text-sm font-bold text-ocean shadow-water transition hover:brightness-105"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

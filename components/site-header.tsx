"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { PointerToggle } from "@/components/pointer-toggle";
import type { HeaderUser } from "@/components/site-nav";
import { TextSizeToggle } from "@/components/text-size-toggle";

/** Auth entry screens keep their focus: brand, text-size, and Help only. */
const AUTH_PATHS = new Set(["/login", "/onboarding"]);

/**
 * Compact top header: brand left; text-size, profile, and sign-in/out right.
 * Primary navigation lives in the left rail (`SiteNav`) so this stays one row
 * at every desktop width and text size.
 */
export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const authScreen = AUTH_PATHS.has(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-[var(--header-height)] items-center border-b border-white/10 bg-ocean/95 text-white shadow-water backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-nowrap items-center justify-between gap-3 px-6">
        <Link
          href="/"
          className="ripple flex items-center gap-2 rounded-xl text-xl font-bold tracking-tight text-white"
        >
          <Image
            src="/logo-mark.png"
            alt=""
            width={512}
            height={512}
            priority
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
          <span className="flex flex-col leading-tight">
            <span>HistorAI</span>
            <span className="text-[0.65rem] font-medium uppercase tracking-wide text-seaglass">
              When I was your age
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <TextSizeToggle />
          <PointerToggle />

          {authScreen ? (
            <Link
              href="/help"
              title="Help and frequently asked questions"
              className="ripple inline-flex min-h-10 items-center rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              Help
            </Link>
          ) : user ? (
            <>
              <Link
                href="/profile"
                data-tour="profile"
                aria-label={`Your profile, ${user.name}`}
                title={`${user.name} · ${user.role === "river" ? "River" : "Drop"}`}
                className="ripple grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
                </svg>
              </Link>
              <LogoutButton compact />
            </>
          ) : (
            <Link
              href="/login"
              data-tour="sign-in"
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

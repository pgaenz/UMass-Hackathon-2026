"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface QuickLink {
  icon: string;
  label: string;
  href: string;
  /** Only shown to signed-in users (e.g. "Your profile"). */
  signedInOnly?: boolean;
}

/** Single source of truth for quick links (header dropdown + home sidebar). */
export const QUICK_LINKS: QuickLink[] = [
  { icon: "🔥", label: "Popular questions", href: "/questions?sort=popular" },
  { icon: "❓", label: "Unanswered", href: "/questions?sort=unanswered" },
  { icon: "💬", label: "Recent answers", href: "/youth" },
  { icon: "👤", label: "Your profile", href: "/profile", signedInOnly: true },
];

/**
 * Compact "Quick links" dropdown for the site header, so the links are one tap
 * away on every screen (see plan/UX-FIXES-2.md §5). Closes on navigation,
 * outside click, and Escape.
 */
export function QuickLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links = QUICK_LINKS.filter((link) => signedIn || !link.signedInOnly);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="ripple inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20"
      >
        <span aria-hidden="true">🧭</span>
        <span className="hidden sm:inline">Quick links</span>
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-seaglass bg-white/95 p-1 shadow-water backdrop-blur"
        >
          {links.map((link) => (
            <li key={link.label}>
              <Link
                role="menuitem"
                href={link.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink transition hover:bg-seaglass/40"
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UnreadBadge } from "@/components/chat/unread-badge";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";

export interface HeaderUser {
  id: string;
  name: string;
  role: Role;
}

interface NavItem {
  href: string;
  label: string;
  /** Optional text count shown after the label (e.g. stories not published yet). */
  count?: number;
  /** Tour hook for the secondary utility links. */
  tour?: string;
}

/** Auth entry screens keep their focus: no rail. */
const AUTH_PATHS = new Set(["/login", "/onboarding"]);

/** Role-specific primary destinations, in the order they appear in the rail. */
export function navItemsFor(user: HeaderUser | null, myStoriesCount = 0): NavItem[] {
  const items: NavItem[] = [{ href: "/", label: "Home" }];

  // One obvious next step per role, placed first after Home.
  if (user?.role === "river") {
    items.push({ href: "/senior", label: "Answer a question" });
    items.push({ href: "/senior/stories", label: "My stories", count: myStoriesCount });
  } else if (user?.role === "drop") {
    items.push({ href: "/questions/new", label: "Ask a question" });
    items.push({ href: "/questions/mine", label: "My questions" });
  }

  // Visitors still browse the full question list; Drops browse below their own.
  if (user?.role !== "river") {
    items.push({ href: "/questions", label: "Browse questions" });
  }

  items.push({ href: "/youth", label: "Read stories" });
  items.push({ href: "/podcasts", label: "Podcasts" });
  if (user) {
    items.push({ href: "/messages", label: "Messages" });
  }

  return items;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (pathname === href) return true;
  // /questions is the browse list only; its /new and /mine children have their own links.
  if (href === "/questions") {
    return (
      pathname.startsWith("/questions/") &&
      !pathname.startsWith("/questions/new") &&
      !pathname.startsWith("/questions/mine")
    );
  }
  return pathname.startsWith(`${href}/`);
}

function RailLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        data-tour={item.tour}
        className={cn(
          "ripple relative flex min-h-11 items-center gap-1 rounded-xl px-3 text-base transition",
          active
            ? "bg-white/80 font-semibold text-ocean shadow-water"
            : "font-medium text-ocean/80 hover:bg-white/60 hover:text-ocean",
        )}
      >
        {active ? (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-brand"
          />
        ) : null}
        <span>{item.label}</span>
        {typeof item.count === "number" && item.count > 0 ? (
          <span className="ml-1 text-sm font-semibold text-brand">{item.count}</span>
        ) : null}
        {item.href === "/messages" ? <UnreadBadge /> : null}
      </Link>
    </li>
  );
}

/**
 * Persistent left rail for desktop widths. Holds the role-specific primary
 * links, then Search and Help. Hidden on the auth entry screens and below the
 * desktop breakpoint (mobile navigation is intentionally out of scope for now).
 */
export function SiteNav({
  user,
  myStoriesCount = 0,
}: {
  user: HeaderUser | null;
  myStoriesCount?: number;
}) {
  const pathname = usePathname();
  if (AUTH_PATHS.has(pathname)) return null;

  const primary = navItemsFor(user, myStoriesCount);
  const secondary: NavItem[] = [
    { href: "/search", label: "Search", tour: "search" },
    { href: "/help", label: "Help", tour: "help" },
  ];

  return (
    <nav
      aria-label="Primary"
      className="sticky top-[var(--header-height)] hidden h-[calc(100vh-var(--header-height))] w-60 shrink-0 self-start overflow-y-auto border-r border-white/60 bg-white/40 px-3 py-5 backdrop-blur lg:block"
    >
      <div data-tour="nav" className="space-y-1">
        <ul className="space-y-1">
          {primary.map((item) => (
            <RailLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
        <div className="my-3 border-t border-ocean/10" />
        <ul className="space-y-1">
          {secondary.map((item) => (
            <RailLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </div>
    </nav>
  );
}

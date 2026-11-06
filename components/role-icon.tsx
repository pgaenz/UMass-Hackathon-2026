import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";

/**
 * Decorative role artwork drawn in `currentColor` so it inherits the surrounding
 * text colour. The card/badge text always names the role, so this stays
 * `aria-hidden`.
 */
export function RoleIcon({ role, className }: { role: Role; className?: string }) {
  if (role === "river") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
        className={cn("h-8 w-8", className)}
      >
        <path d="M3 8.5c3-2.6 6-2.6 9 0s6 2.6 9 0" />
        <path d="M3 15.5c3-2.6 6-2.6 9 0s6 2.6 9 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-8 w-8", className)}>
      <path
        d="M12 1.5c0 0 8.6 10.6 8.6 15.7a8.6 8.6 0 1 1-17.2 0C3.4 12.1 12 1.5 12 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

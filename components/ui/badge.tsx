import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-seaglass/50 px-3 py-1 text-sm font-semibold text-brand",
        className,
      )}
    >
      {children}
    </span>
  );
}

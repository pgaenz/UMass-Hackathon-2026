import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

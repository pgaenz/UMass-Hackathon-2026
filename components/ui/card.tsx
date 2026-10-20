import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-orange-100 bg-surface p-6 shadow-sm", className)}
      {...props}
    />
  );
}

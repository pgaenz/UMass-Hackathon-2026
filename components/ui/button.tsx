import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "brand" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "ripple inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<Variant, string> = {
  // Solid sunset-gold CTA: high contrast against the dominant blues.
  primary: "bg-sunset text-ocean shadow-water hover:brightness-[1.04]",
  // Blue CTA for secondary paths that still need emphasis.
  brand: "bg-brand text-white shadow-water hover:bg-accent",
  // Frosted outline button that sits on the glass surfaces.
  secondary:
    "border border-seaglass bg-white/60 text-ocean backdrop-blur hover:border-brand hover:bg-white/80",
  ghost: "text-brand hover:bg-white/70",
};

const sizeClasses: Record<Size, string> = {
  md: "min-h-11 px-5 py-2.5 text-base",
  lg: "min-h-14 px-7 py-3.5 text-lg",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}): string {
  return cn(base, variantClasses[variant], sizeClasses[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}

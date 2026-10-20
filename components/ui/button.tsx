import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Record<Variant, string> = {
  primary: "bg-sky-700 text-white hover:bg-sky-800",
  secondary:
    "border-2 border-slate-300 bg-white text-slate-900 hover:border-sky-700 hover:bg-sky-50",
  ghost: "text-sky-800 hover:bg-sky-50",
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

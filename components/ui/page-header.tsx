import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      {description ? <p className="max-w-3xl text-xl text-slate-600">{description}</p> : null}
      {children}
    </div>
  );
}

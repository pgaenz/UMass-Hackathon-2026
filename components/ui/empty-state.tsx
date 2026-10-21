import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl glass border-2 border-dashed border-seaglass/70 p-8 text-center">
      <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-lg text-ink/70">{description}</p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}

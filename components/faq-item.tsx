import type { ReactNode } from "react";

/**
 * One FAQ entry built on native <details>/<summary>, so it works without
 * JavaScript, is keyboard accessible, and keeps large-text settings intact.
 * An optional id makes individual answers linkable (for example /help#privacy).
 */
export function FaqItem({
  id,
  question,
  children,
}: {
  id?: string;
  question: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className="group scroll-mt-24 rounded-2xl border border-white/70 bg-white/60 shadow-water backdrop-blur-sm target:border-brand"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-2xl px-5 py-4 text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-seaglass/40 text-2xl font-bold leading-none text-ocean transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="space-y-3 border-t border-seaglass/40 px-5 pb-5 pt-4 text-lg leading-relaxed text-ink/80 [&_a]:font-semibold [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4">
        {children}
      </div>
    </details>
  );
}

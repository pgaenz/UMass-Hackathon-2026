"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-4xl font-bold tracking-tight text-ink">Something went wrong</h1>
      <p className="text-xl text-ink/70">An unexpected error occurred.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-brand px-6 py-3 text-lg font-semibold text-white hover:bg-orange-600"
      >
        Try again
      </button>
    </section>
  );
}

"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Something went wrong</h1>
      <p className="text-xl text-slate-600">An unexpected error occurred.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-sky-700 px-6 py-3 text-lg font-semibold text-white hover:bg-sky-800"
      >
        Try again
      </button>
    </section>
  );
}

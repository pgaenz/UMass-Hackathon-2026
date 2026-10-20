import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-6 py-10">
      <h1 className="text-4xl font-bold tracking-tight text-ink">Page not found</h1>
      <p className="text-xl text-ink/70">That page doesn&apos;t exist.</p>
      <Link href="/" className="inline-block text-lg font-semibold text-brand hover:underline">
        Back to home
      </Link>
    </section>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">Page not found</h1>
      <p className="text-xl text-slate-600">That page doesn&apos;t exist.</p>
      <Link href="/" className="inline-block text-lg font-semibold text-sky-700 hover:underline">
        Back to home
      </Link>
    </section>
  );
}

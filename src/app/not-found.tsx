import Link from 'next/link';

/** Clear recovery path for expired links and mistyped URLs. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">MoneyXprt</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">The link may be out of date, or this page may have moved.</p>
        <Link href="/dashboard" className="mt-6 flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">Go to dashboard</Link>
      </section>
    </main>
  );
}

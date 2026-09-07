'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/** Customer-safe recovery screen for errors inside the application shell. */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Keep diagnostic information in the server/client observability pipeline.
    // Do not show implementation details or personal data to the customer.
    console.error('Application route error', { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">MoneyXprt</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">That page needs another try</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Your saved information is still there. Try again, or return to your dashboard.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">Try again</button>
          <Link href="/dashboard" className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Dashboard</Link>
        </div>
      </section>
    </main>
  );
}

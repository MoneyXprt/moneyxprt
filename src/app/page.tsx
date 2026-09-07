'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

const painPoints = [
  'You save. But your money sits in a bank earning nothing while inflation eats it.',
  "You invest. But you're picking stocks without a system — and guessing on timing.",
  'You file taxes. But you have no idea how much you’re leaving on the table every April.',
];

const features = [
  ['📊', 'Know your number', 'Net worth, investments, and cash flow in one place. Updated automatically.'],
  ['⏰', 'Know when to act', 'Tax moves before December 31. When to invest. When to pay down debt. Timed perfectly.'],
  ['🎯', 'Know what to do', 'Personalized strategies ranked by dollar impact. No generic advice.'],
  ['🚫', 'No 1% fee', 'Built by a CFO. Not a financial advisor trying to sell you insurance.'],
] as const;

function EarlyAccessButton() {
  return (
    <Link href="/ask" className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#d4a843] px-7 text-base font-bold text-[#0d1f15] transition hover:bg-[#e2bb62] focus-visible:outline-[#d4a843]">
      Join the waitlist <span aria-hidden="true" className="ml-2">→</span>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    getBrowserSupabaseClient().auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        if (session) {
          router.replace('/dashboard');
          return;
        }
        setCheckingAuth(false);
      })
      .catch(() => { if (mounted) setCheckingAuth(false); });

    return () => { mounted = false; };
  }, [router]);

  if (checkingAuth) return <main className="min-h-screen bg-[#0d1f15]" />;

  return (
    <main className="bg-[#0d1f15] text-white">
      <section className="flex min-h-screen items-center px-6 py-20 sm:px-10">
        <div className="mx-auto w-full max-w-3xl text-center animate-fade-in">
          <h1 className="text-balance text-5xl font-bold tracking-[-0.055em] sm:text-7xl">You&apos;re good with money.<br />MoneyXprt makes you great.</h1>
          <p className="mx-auto mt-7 max-w-2xl text-pretty text-lg leading-8 text-[#d4a843] sm:text-xl">A financial command center for high-earning W2 professionals who want to keep more, invest smarter, and know exactly when to act — without paying someone 1% to put their money in a mutual fund.</p>
          <div className="mt-10"><EarlyAccessButton /></div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 text-[#172219] sm:px-10 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Sound familiar?</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {painPoints.map((point, index) => (
              <article key={point} className="rounded-2xl border border-[#e6e6e0] p-7 shadow-[0_1px_2px_rgba(13,31,21,0.04)] sm:p-8">
                <p className="text-sm font-semibold text-[#a37d2c]">0{index + 1}</p>
                <p className="mt-5 text-xl font-medium leading-8 tracking-[-0.025em]">{point}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d1f15] px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-4xl font-bold tracking-[-0.045em] sm:text-5xl">MoneyXprt gives you the system.</h2>
          <div className="mt-10 divide-y divide-white/15 border-y border-white/15">
            {features.map(([icon, title, description]) => (
              <article key={title} className="grid grid-cols-[2.25rem_1fr] gap-4 py-6 sm:grid-cols-[3rem_1fr] sm:py-7">
                <span aria-hidden="true" className="text-2xl sm:text-3xl">{icon}</span>
                <div><h3 className="text-xl font-bold tracking-[-0.02em]">{title}</h3><p className="mt-2 max-w-2xl text-base leading-7 text-white/70">{description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 text-[#172219] sm:px-10 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[#a37d2c]">Built by someone who had the same problem.</h2>
          <div className="mt-7 space-y-5 text-xl leading-8 tracking-[-0.02em] sm:text-2xl sm:leading-9">
            <p>I&apos;m Ian, a CFO. I spent 15 years making billionaires more money.</p>
            <p>Last year I sat down with my own finances and found $50,000 I was leaving on the table.</p>
            <p className="font-bold">If it can happen to a CFO — it can happen to you.</p>
            <p>I built MoneyXprt so it never happens again.</p>
          </div>
        </div>
      </section>

      <section className="bg-[#0d1f15] px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-5xl font-bold tracking-[-0.055em] sm:text-6xl">Stop guessing. Start knowing.</h2>
          <p className="mt-6 text-lg text-[#d4a843] sm:text-xl">Join the waitlist. Free during private alpha.</p>
          <div className="mt-9"><EarlyAccessButton /></div>
          <p className="mt-5 text-sm leading-6 text-white/55">No credit card. No commitment.<br />Cancel anytime when we launch.</p>
        </div>
      </section>
    </main>
  );
}

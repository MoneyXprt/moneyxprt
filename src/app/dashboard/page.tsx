'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanProgress {
  visionDone:   boolean;
  numberDone:   boolean;
  snapshotDone: boolean;
}

const PLAN_STEPS: { key: keyof PlanProgress | 'assets' | 'constraints'; label: string }[] = [
  { key: 'visionDone',   label: 'Freedom Vision' },
  { key: 'numberDone',   label: 'Freedom Number' },
  { key: 'snapshotDone', label: 'Financial Snapshot' },
  { key: 'assets',       label: 'Asset Preferences' },
  { key: 'constraints',  label: 'Constraints' },
];

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await getBrowserSupabaseClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  };

  useEffect(() => {
    const { data: { subscription } } = getBrowserSupabaseClient().auth.onAuthStateChange(
      (_e, s) => { if (s) onSession(s); },
    );
    return () => subscription.unsubscribe();
  }, [onSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Sign in to MoneyXprt</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">We&apos;ll send a one-click sign-in link.</p>
        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-0.5 text-emerald-600">Magic link sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition" />
            {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
              {busy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Progress step row ────────────────────────────────────────────────────────

function StepRow({ label, done, locked }: { label: string; done: boolean; locked?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      {done ? (
        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : locked ? (
        <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full border-2 border-emerald-300 flex items-center justify-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
      )}
      <span className={`text-sm flex-1 ${done ? 'text-gray-900 font-medium' : locked ? 'text-gray-400' : 'text-gray-700'}`}>
        {label}
      </span>
      {locked && <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide">Soon</span>}
      {!done && !locked && <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Next</span>}
    </div>
  );
}

// ─── Plan progress card ───────────────────────────────────────────────────────

function PlanCard({ progress, loading }: { progress: PlanProgress | null; loading: boolean }) {
  const steps = [
    progress?.visionDone ?? false,
    progress?.numberDone ?? false,
    progress?.snapshotDone ?? false,
    false, // assets — not built
    false, // constraints — not built
  ];
  const doneCount = steps.filter(Boolean).length;
  const hasStarted = doneCount > 0;
  const allCoreComplete = (progress?.visionDone && progress?.numberDone && progress?.snapshotDone) ?? false;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header band */}
      <div className="bg-emerald-600 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wide mb-1">
              {hasStarted ? `Step ${doneCount} of 5 complete` : 'Start here'}
            </p>
            <h2 className="text-white text-xl font-bold leading-tight">Build Your Freedom Plan</h2>
            <p className="text-emerald-300 text-sm mt-0.5">Takes about 15 minutes</p>
          </div>
          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/60 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        {!loading && (
          <div className="mt-4 flex gap-1">
            {steps.map((done, i) => (
              <div key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                  done ? 'bg-white' : i === doneCount && i < 3 ? 'bg-emerald-400/60' : 'bg-emerald-700/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Step list */}
      <div className="px-5 divide-y divide-gray-50">
        {loading ? (
          <div className="py-6 flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 rounded-full bg-gray-100 animate-pulse" style={{ width: `${60 + i * 10}%` }} />
            ))}
          </div>
        ) : (
          PLAN_STEPS.map((step, i) => {
            const done = i < 3 ? steps[i] : false;
            const locked = i >= 3;
            return <StepRow key={step.key} label={step.label} done={done} locked={locked} />;
          })
        )}
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 pt-4">
        <Link
          href="/dashboard/plan"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition"
        >
          {allCoreComplete ? 'View your plan' : hasStarted ? 'Continue your plan' : 'Start my plan'}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

// ─── Quick-link card ──────────────────────────────────────────────────────────

function QuickLink({ href, label, sublabel, icon }: {
  href: string; label: string; sublabel: string; icon: React.ReactNode;
}) {
  return (
    <Link href={href}
      className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5 hover:bg-gray-50 hover:border-gray-200 transition group">
      <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{label}</p>
        <p className="text-xs text-gray-400 truncate">{sublabel}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 shrink-0 group-hover:text-indigo-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const [session, setSession]           = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [progress, setProgress]         = useState<PlanProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);

  const loadProgress = useCallback(async (userId: string) => {
    const sb = getBrowserSupabaseClient();
    setProgressLoading(true);

    const [{ data: profile }, { count: snapCount }] = await Promise.all([
      sb.from('freedom_profiles')
        .select('freedom_type, freedom_number_monthly')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('financial_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    setProgress({
      visionDone:   !!profile?.freedom_type,
      numberDone:   Number(profile?.freedom_number_monthly ?? 0) > 0,
      snapshotDone: (snapCount ?? 0) > 0,
    });
    setProgressLoading(false);
  }, []);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) loadProgress(s.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadProgress(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, [loadProgress]);

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  const doneCount = [
    progress?.visionDone,
    progress?.numberDone,
    progress?.snapshotDone,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[180px]">{session.user.email}</span>
            <button onClick={() => getBrowserSupabaseClient().auth.signOut()}
              className="text-xs text-gray-500 hover:text-gray-900 transition px-2.5 py-1.5 rounded-lg hover:bg-gray-100">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {doneCount === 0 ? 'Welcome to MoneyXprt.' : doneCount < 3 ? 'Keep going.' : 'You\'re on track.'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {doneCount === 0
              ? 'Start with your freedom vision — it takes about 15 minutes.'
              : doneCount < 3
                ? `${doneCount} of 3 core steps complete. Let's finish the foundation.`
                : 'Your foundation is set. Asset preferences and constraints are next.'}
          </p>
        </div>

        {/* Build Your Plan card */}
        <PlanCard progress={progress} loading={progressLoading} />

        {/* Quick links */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-0.5">Quick access</p>
          <div className="flex flex-col gap-2">
            <QuickLink
              href="/dashboard/audit/results"
              label="Tax Strategy Audit"
              sublabel="See your identified savings opportunities"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
              }
            />
            <QuickLink
              href="/dashboard/logs"
              label="Material Participation Logs"
              sublabel="Log and classify your real estate hours"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}

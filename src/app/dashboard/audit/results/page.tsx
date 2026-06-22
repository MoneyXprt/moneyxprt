'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { evaluateAll } from '@/app/lib/strategies';
import type { StrategyResult } from '@/app/lib/strategies';
import type { Session } from '@supabase/supabase-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const sb = getBrowserSupabaseClient();
    const { error: err } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard/audit/results` },
    });
    setLoading(false);
    if (err) setError(err.message); else setSent(true);
  };

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, s) => {
      if (s) onSession(s);
    });
    return () => subscription.unsubscribe();
  }, [onSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 mb-4">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Sign in to see your results</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">We&apos;ll send a one-click sign-in link.</p>
        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-sm text-emerald-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-0.5 text-emerald-600">Magic link sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Strategy cards ───────────────────────────────────────────────────────────

function ActiveCard({ r }: { r: StrategyResult }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
          <span className="text-sm font-semibold text-gray-900">{r.name}</span>
        </div>
        <span className="text-base font-bold text-emerald-700 tabular-nums shrink-0">
          {fmt(r.estimatedAnnualValue)}<span className="text-xs font-normal text-emerald-600">/yr</span>
        </span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed pl-4">{r.reason}</p>
    </div>
  );
}

function VerifyCard({ r }: { r: StrategyResult }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-900">{r.name}</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed pl-4 mb-3">{r.reason}</p>
      {r.blockedBy && (
        <div className="ml-4 flex items-start gap-2 rounded-lg bg-amber-100/70 border border-amber-200/60 px-3 py-2.5">
          <svg className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-medium">Action required: </span>{r.blockedBy}
          </p>
        </div>
      )}
    </div>
  );
}

function LockedCard({ r }: { r: StrategyResult }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm font-medium text-gray-500">{r.name}</span>
        </div>
        {r.estimatedAnnualValue > 0 && (
          <span className="text-xs text-gray-400 tabular-nums shrink-0">
            Potential: {fmt(r.estimatedAnnualValue)}/yr
          </span>
        )}
      </div>
      {r.unlockCondition && (
        <p className="text-xs text-gray-500 leading-relaxed pl-5">{r.unlockCondition}</p>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, badge, badgeColor, children, empty,
}: {
  title: string;
  badge: number;
  badgeColor: string;
  children: React.ReactNode;
  empty?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {badge === 0
          ? <p className="text-xs text-gray-400 py-2 text-center">{empty}</p>
          : children}
      </div>
    </div>
  );
}

// ─── Hero number ──────────────────────────────────────────────────────────────

function HeroStat({ value, snapshotDate }: { value: number; snapshotDate?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Annual Tax Savings Identified</p>
      <p className="text-4xl font-extrabold text-gray-900 tabular-nums leading-none">
        {fmt(value)}
        <span className="text-lg font-normal text-gray-400 ml-1">/yr</span>
      </p>
      <p className="mt-2 text-sm text-gray-500">
        across all available strategies — based on your financial snapshot
        {snapshotDate && (
          <span className="text-gray-400"> from {new Date(snapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        )}
        .
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      {[80, 60, 80, 50, 80].map((w, i) => (
        <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditResultsPage() {
  const [session, setSession]         = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [results, setResults]         = useState<StrategyResult[] | null>(null);
  const [snapshotDate, setSnapshotDate] = useState<string | undefined>();
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(true);

  // ── Session init ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Load snapshot + run engine ───────────────────────────────────────────
  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getLatestSnapshot();
      if (!snapshot) {
        setHasSnapshot(false);
        setLoading(false);
        return;
      }
      // Capture created_at for display via the raw Supabase query
      const sb = getBrowserSupabaseClient();
      const { data: row } = await sb
        .from('financial_snapshots')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row?.created_at) setSnapshotDate(row.created_at as string);

      setResults(evaluateAll(snapshot));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your audit results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) runAudit();
  }, [session, runAudit]);

  // ── Render guards ────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  // ── Derive grouped results ───────────────────────────────────────────────
  const active = results?.filter(r => r.state === 'ACTIVE').sort((a, b) => b.estimatedAnnualValue - a.estimatedAnnualValue) ?? [];
  const verify = results?.filter(r => r.state === 'VERIFY') ?? [];
  const locked = results?.filter(r => r.state === 'LOCKED') ?? [];
  const totalActiveValue = active.reduce((sum, r) => sum + r.estimatedAnnualValue, 0);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top nav ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Velocity Audit</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[180px]">{session.user.email}</span>
            <button
              onClick={() => getBrowserSupabaseClient().auth.signOut()}
              className="text-xs text-gray-500 hover:text-gray-900 transition px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Page heading ───────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Your Velocity Audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Strategy opportunities identified from your financial snapshot, ranked by annual impact.
          </p>
        </div>

        {/* ── Loading / error / empty states ─────────────────────────── */}
        {loading && <Skeleton />}

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && !hasSnapshot && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">No snapshot yet</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
              Complete your financial intake to see your personalised strategy analysis.
            </p>
            <Link
              href="/dashboard/audit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            >
              Take the audit
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────── */}
        {!loading && !error && results && (
          <>
            {/* Hero stat */}
            <HeroStat value={totalActiveValue} snapshotDate={snapshotDate} />

            {/* Available Now */}
            <Section
              title="Available Now"
              badge={active.length}
              badgeColor="bg-emerald-100 text-emerald-700"
              empty="No strategies currently active — update your numbers to see opportunities."
            >
              {active.map(r => <ActiveCard key={r.id} r={r} />)}
            </Section>

            {/* Verify These */}
            <Section
              title="Verify These"
              badge={verify.length}
              badgeColor="bg-amber-100 text-amber-700"
              empty="Nothing to verify right now."
            >
              {verify.map(r => <VerifyCard key={r.id} r={r} />)}
            </Section>

            {/* Unlock Later */}
            <Section
              title="Unlock Later"
              badge={locked.length}
              badgeColor="bg-gray-100 text-gray-500"
              empty="No locked strategies."
            >
              {locked.map(r => <LockedCard key={r.id} r={r} />)}
            </Section>

            {/* CTA */}
            <div className="flex items-center justify-between pt-2 pb-4">
              <p className="text-xs text-gray-400">
                Estimates are illustrative — consult a tax professional before acting.
              </p>
              <Link
                href="/dashboard/audit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Update my numbers
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

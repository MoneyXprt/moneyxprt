'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanAction {
  text: string;
  priority: 'high' | 'medium' | 'low';
  annualValue?: number;
}

interface PlanPhase {
  number: number;
  title: string;
  status: 'active' | 'pending';
  reason: string;
  actions: PlanAction[];
}

interface TaxStrategy {
  id: string;
  name: string;
  estimatedAnnualValue: number;
}

interface PlanData {
  freedomGap: {
    freedomNumberMonthly: number;
    currentPassiveMonthly: number;
    gapMonthly: number;
    projectedFreedomYear: number;
    yearsToFreedom: number;
  };
  phases: PlanPhase[];
  taxStrategyStack: {
    annualValue: number;
    strategies: TaxStrategy[];
    addedToDeployableCapital: number;
  };
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function getNextAction(phases: PlanPhase[]): PlanAction | null {
  for (const phase of phases) {
    if (phase.status !== 'active') continue;
    const sorted = [...phase.actions].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );
    if (sorted[0]) return sorted[0];
  }
  return null;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const REPS_TARGET = 750;
const currentYear = new Date().getFullYear();
const nowMonth    = new Date().getMonth(); // 0-indexed; 5 = June

function repsStatus(hours: number): { label: string; color: string } {
  if (hours >= REPS_TARGET)      return { label: 'Complete', color: 'text-emerald-600' };
  if (nowMonth >= 6 && hours < REPS_TARGET / 2)
                                  return { label: 'Behind',   color: 'text-amber-600' };
  return                               { label: 'On track',  color: 'text-indigo-600' };
}

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

// ─── No-plan CTA ─────────────────────────────────────────────────────────────

function NoPlanCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-gray-900">Build your freedom plan</h2>
      <p className="mt-1 text-sm text-gray-500 mb-5 leading-relaxed">
        Complete your financial profile and we&apos;ll generate a personalised roadmap to financial freedom — with a projected year, asset roadmap, and tax strategy stack.
      </p>
      <Link href="/dashboard/plan"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition">
        Build my freedom plan →
      </Link>
    </div>
  );
}

// ─── Freedom Gap Hero ─────────────────────────────────────────────────────────

function FreedomGapHero({ plan }: { plan: PlanData }) {
  const { freedomNumberMonthly, currentPassiveMonthly, gapMonthly, projectedFreedomYear, yearsToFreedom } = plan.freedomGap;
  const pct = freedomNumberMonthly > 0
    ? Math.min(100, Math.round((currentPassiveMonthly / freedomNumberMonthly) * 100))
    : 0;

  return (
    <div className="bg-emerald-600 rounded-2xl p-6 text-white">
      <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-4">Your Freedom Plan</p>

      <div className="space-y-2 mb-5">
        {[
          { label: 'Freedom Number',       value: `${fmt(freedomNumberMonthly)}/mo`,    cls: 'text-white font-bold' },
          { label: 'Current Passive Income', value: `${fmt(currentPassiveMonthly)}/mo`, cls: 'text-emerald-100 font-semibold' },
          { label: 'Gap to Close',         value: `${fmt(gapMonthly)}/mo`,               cls: 'text-amber-300 font-bold' },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-sm text-emerald-200">{row.label}</span>
            <span className={`text-base tabular-nums ${row.cls}`}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Projected year — dominant element */}
      <div className="text-center py-4">
        <p className="text-6xl font-extrabold tracking-tight leading-none">
          {yearsToFreedom === 0 ? '🎯' : projectedFreedomYear}
        </p>
        <p className="text-emerald-300 text-sm mt-1.5">
          {yearsToFreedom === 0 ? 'Freedom achieved.' : `Projected freedom year — ${yearsToFreedom} year${yearsToFreedom !== 1 ? 's' : ''} away`}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="h-2 bg-emerald-700/60 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-emerald-300 mt-1.5 text-center">{pct}% of your freedom gap closed</p>
      </div>
    </div>
  );
}

// ─── Next action card ─────────────────────────────────────────────────────────

function NextActionCard({ action }: { action: PlanAction }) {
  const priorityColor = action.priority === 'high' ? 'bg-red-500' : action.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-300';
  return (
    <div className="bg-white rounded-2xl border-l-4 border-indigo-500 border border-gray-100 shadow-sm px-5 py-4">
      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2">Your next action</p>
      <div className="flex items-start gap-2.5">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${priorityColor}`} />
        <p className="text-sm text-gray-800 leading-relaxed font-medium">{action.text}</p>
      </div>
    </div>
  );
}

// ─── Phase card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase }: { phase: PlanPhase }) {
  const topAction = [...phase.actions].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  )[0];

  const statusStyles: Record<string, string> = {
    active:  'bg-emerald-100 text-emerald-700',
    pending: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${phase.status === 'pending' ? 'opacity-70' : ''}`}>
      <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {phase.number}
          </div>
          <p className="text-sm font-semibold text-gray-900">{phase.title}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${statusStyles[phase.status] ?? statusStyles.pending}`}>
          {phase.status}
        </span>
      </div>
      {topAction && (
        <div className="px-4 py-3 flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${{
            high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-gray-300',
          }[topAction.priority]}`} />
          <p className="text-xs text-gray-600 leading-relaxed">{topAction.text}</p>
          {topAction.annualValue ? (
            <span className="ml-auto text-xs font-bold text-emerald-700 shrink-0 tabular-nums">{fmt(topAction.annualValue)}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Tax strategy panel ───────────────────────────────────────────────────────

function TaxStrategyPanel({ stack }: { stack: PlanData['taxStrategyStack'] }) {
  const top3 = stack.strategies
    .sort((a, b) => b.estimatedAnnualValue - a.estimatedAnnualValue)
    .slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            Adding {fmt(stack.addedToDeployableCapital)}/yr to your capital
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Tax savings working as your investment engine</p>
        </div>
        <Link href="/dashboard/audit/results"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition shrink-0 ml-3">
          Full audit →
        </Link>
      </div>
      <div className="divide-y divide-gray-50">
        {top3.map(s => (
          <div key={s.id} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-700 truncate mr-3">{s.name}</span>
            <span className="text-sm font-bold text-emerald-700 tabular-nums shrink-0">{fmt(s.estimatedAnnualValue)}/yr</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── REPS tracker ─────────────────────────────────────────────────────────────

function REPSTracker({ hoursLogged }: { hoursLogged: number }) {
  const pct    = Math.min(100, Math.round((hoursLogged / REPS_TARGET) * 100));
  const status = repsStatus(hoursLogged);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">REPS Hours — {currentYear}</p>
          <p className="text-xs text-gray-400">750 hours required for material participation</p>
        </div>
        <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-extrabold text-gray-900 tabular-nums leading-none">
          {Math.round(hoursLogged)}
        </span>
        <span className="text-sm text-gray-400 mb-0.5">of {REPS_TARGET} hrs</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{pct}% of annual target</p>
      <Link href="/dashboard/logs"
        className="mt-3 flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
        Log hours →
      </Link>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const actions = [
    { label: 'Update my numbers', sub: 'Keep your plan current', href: '/dashboard/audit',         icon: '✏️' },
    { label: 'Log REPS hours',    sub: 'Material participation log', href: '/dashboard/logs',        icon: '⏱️' },
    { label: 'Full plan view',    sub: 'Roadmap & tax strategies', href: '/dashboard/plan/results', icon: '📋' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map(a => (
        <Link key={a.href} href={a.href}
          className="flex flex-col items-center text-center gap-1.5 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-4 hover:bg-gray-50 hover:border-gray-200 transition active:scale-95">
          <span className="text-xl">{a.icon}</span>
          <p className="text-xs font-semibold text-gray-900 leading-tight">{a.label}</p>
          <p className="text-[10px] text-gray-400 leading-tight">{a.sub}</p>
        </Link>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="h-6 rounded-full bg-gray-200 animate-pulse w-1/3" />
      <div className="h-64 rounded-2xl bg-emerald-100 animate-pulse" />
      <div className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const [session, setSession]     = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loading, setLoading]     = useState(true);
  const [plan, setPlan]           = useState<PlanData | null>(null);
  const [repsHours, setRepsHours] = useState(0);
  const [stale, setStale]         = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) loadData(s.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadData(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadData(userId: string) {
    setLoading(true);
    const sb = getBrowserSupabaseClient();

    const [
      { data: planRow },
      { data: repsRows },
    ] = await Promise.all([
      sb.from('generated_plans')
        .select('freedom_gap, phases, tax_strategy_stack, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('material_participation_logs')
        .select('hours_logged')
        .eq('user_id', userId)
        .gte('date', `${currentYear}-01-01`)
        .lt('date', `${currentYear + 1}-01-01`),
    ]);

    if (planRow) {
      setPlan({
        freedomGap:       planRow.freedom_gap as PlanData['freedomGap'],
        phases:           planRow.phases as PlanPhase[],
        taxStrategyStack: planRow.tax_strategy_stack as PlanData['taxStrategyStack'],
        createdAt:        planRow.created_at as string,
      });
      setStale(daysSince(planRow.created_at as string) >= 90);
    }

    if (repsRows) {
      const total = repsRows.reduce((s, r) => s + Number(r.hours_logged ?? 0), 0);
      setRepsHours(total);
    }

    setLoading(false);
  }

  // ── Render guards ────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;
  if (loading)  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 h-14" />
      <Skeleton />
    </div>
  );

  const nextAction = plan ? getNextAction(plan.phases) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
          </div>
          <button onClick={() => getBrowserSupabaseClient().auth.signOut()}
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Stale plan banner */}
        {stale && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-800 flex-1">
              Your plan is 90+ days old.{' '}
              <Link href="/dashboard/audit" className="font-semibold underline underline-offset-2">Update your numbers →</Link>
            </p>
          </div>
        )}

        {/* No plan */}
        {!plan && <NoPlanCard />}

        {plan && (
          <>
            {/* Next action — above everything */}
            {nextAction && <NextActionCard action={nextAction} />}

            {/* Freedom gap hero */}
            <FreedomGapHero plan={plan} />

            {/* Phase cards */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">Your plan phases</p>
              <div className="space-y-2.5">
                {plan.phases.map(p => <PhaseCard key={p.number} phase={p} />)}
              </div>
            </div>

            {/* Tax strategy panel */}
            {plan.taxStrategyStack.strategies.length > 0 && (
              <TaxStrategyPanel stack={plan.taxStrategyStack} />
            )}

            {/* REPS tracker */}
            <REPSTracker hoursLogged={repsHours} />

            {/* Quick actions */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">Quick actions</p>
              <QuickActions />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

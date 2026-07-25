'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Tooltip } from '@/components/Tooltip';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { calculateFreedomScore } from '@/app/lib/freedomScore';
import type { FreedomScoreBreakdown } from '@/app/lib/freedomScore';
import type { FinancialPhase } from '@/app/lib/financialPhase';
import { computeRepsRelevance } from '@/app/lib/planGenerator';
import type { AssetRoadmapRow } from '@/app/lib/planGenerator';
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
  return                               { label: 'On track',  color: 'text-emerald-600' };
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
        <div className="w-10 h-10 rounded-xl bg-[#1B3A2D] flex items-center justify-center mb-4">
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
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" />
            {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
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
    <div className="bg-[#1B3A2D] -mx-4 sm:mx-0 sm:rounded-2xl px-5 pt-7 pb-6 text-white">
      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-5">Projected Freedom</p>

      <div className="text-center mb-4">
        <p className="text-7xl font-extrabold tracking-tight leading-none">
          {yearsToFreedom === 0 ? '🎯' : projectedFreedomYear}
        </p>
        <p className="text-emerald-400 text-sm mt-2 font-medium flex items-center justify-center gap-1">
          {yearsToFreedom === 0
            ? 'Freedom achieved.'
            : `Free in ${yearsToFreedom} year${yearsToFreedom !== 1 ? 's' : ''}`}
          <Tooltip content="Your projected freedom year is calculated by modeling how long it takes your asset income to equal your freedom number, given your current capital deployment rate, tax savings, and selected asset engines. Move the levers in Plan Assumptions to see it change." />
        </p>
      </div>

      {gapMonthly > 0 && (
        <p className="text-center text-xl font-bold tabular-nums text-[#C9A84C] mb-4 flex items-center justify-center gap-1">
          {fmt(gapMonthly)}/mo gap remaining
          <Tooltip content={`This is the difference between what your assets currently generate without you working (${fmt(currentPassiveMonthly)}/mo) and what you need to be free (${fmt(freedomNumberMonthly)}/mo). Every asset you acquire and every tax strategy you implement closes this gap.`} />
        </p>
      )}

      <div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-emerald-400 mt-1.5 text-center flex items-center justify-center gap-1">
          {pct}% of freedom gap closed
          <Tooltip content={`This bar fills as your passive income grows relative to your freedom number. At 100% you're free. Right now you're generating ${pct}% of what you need — ${fmt(currentPassiveMonthly)}/mo of ${fmt(freedomNumberMonthly)}/mo.`} />
        </p>
      </div>
    </div>
  );
}

// ─── Next action card ─────────────────────────────────────────────────────────

function NextActionCard({ text, annualValue, showLink }: {
  text: string;
  annualValue?: number;
  showLink?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border-l-4 border-l-emerald-500 border border-gray-100 shadow-sm px-4 py-4 min-h-[44px]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Your next action</p>
        {showLink && (
          <Link href="/dashboard/execute" className="text-[10px] font-semibold text-gray-400 hover:text-gray-700 transition">
            View all →
          </Link>
        )}
      </div>
      <p className="text-sm text-gray-800 leading-relaxed">{text}</p>
      {annualValue != null && annualValue > 0 && (
        <p className="mt-1.5 text-xs font-bold text-emerald-600 tabular-nums">{fmt(annualValue)}/yr</p>
      )}
    </div>
  );
}

// ─── Freedom Score card ───────────────────────────────────────────────────────

const RING_C = 283; // 2π × 45

function FreedomScoreCard({ breakdown }: { breakdown: FreedomScoreBreakdown }) {
  const { total, plan, strategies, assets, execution } = breakdown;
  const ringColor = total > 60 ? '#10b981' : total >= 30 ? '#f59e0b' : '#9ca3af';
  const ringOffset = RING_C - (total / 100) * RING_C;

  return (
    <Link href="/dashboard/execute"
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:bg-gray-50 transition">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Freedom Score</p>

      <div className="flex items-center gap-5 mb-4">
        {/* Circular progress ring */}
        <div className="relative w-[88px] h-[88px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="9" />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke={ringColor}
              strokeWidth="9"
              strokeDasharray={RING_C}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold text-gray-900 leading-none">{total}</span>
            <span className="text-[10px] text-gray-400 leading-none mt-0.5">/ 100</span>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {([
            { label: 'Plan Setup',   score: plan,       max: 20 },
            { label: 'Strategies',   score: strategies, max: 30 },
            { label: 'Assets',       score: assets,     max: 30 },
            { label: 'Execution',    score: execution,  max: 20 },
          ] as const).map(({ label, score, max }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-500 leading-none">{label}</span>
                <span className="text-[10px] font-semibold text-gray-600 tabular-nums">{score}/{max}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${max > 0 ? (score / max) * 100 : 0}%`, backgroundColor: ringColor, transition: 'width 0.7s ease' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-right leading-none">Tap to improve your score →</p>
    </Link>
  );
}

// ─── Wealth Scoreboard ────────────────────────────────────────────────────────

function WealthScoreboardCard({
  implementedStrategies, activeStrategies, activatedSavings, rental, dividend,
}: {
  implementedStrategies: number; activeStrategies: number; activatedSavings: number;
  rental: number; dividend: number;
}) {
  const assetsAcquired = (rental > 0 ? 1 : 0) + (dividend > 0 ? 1 : 0);

  return (
    <Link href="/dashboard/execute"
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-5 hover:bg-gray-50 transition">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4" fill="#C9A84C" viewBox="0 0 24 24">
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Your Scoreboard</p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-semibold text-gray-700">Strategies Activated</p>
            <span className="text-xs font-bold text-emerald-600 tabular-nums">
              {implementedStrategies} of {activeStrategies}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${activeStrategies > 0 ? (implementedStrategies / activeStrategies) * 100 : 0}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-semibold text-gray-700">Annual Savings Protected</p>
            <span className="text-xs font-bold text-emerald-600 tabular-nums">{fmt(activatedSavings)}/yr</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (activatedSavings / 50000) * 100)}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-semibold text-gray-700">Asset Engines</p>
            <span className="text-xs font-bold text-emerald-600 tabular-nums">{assetsAcquired} of 2</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${(assetsAcquired / 2) * 100}%` }} />
          </div>
          {assetsAcquired === 0 && (
            <p className="text-[10px] text-gray-400 mt-1">First rental or index position unlocks this</p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Phase card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase }: { phase: PlanPhase }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...phase.actions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const topAction = sorted[0];

  const statusStyles: Record<string, string> = {
    active:  'bg-emerald-100 text-emerald-700',
    pending: 'bg-gray-100 text-gray-500',
  };
  const dotColors: Record<string, string> = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-gray-300' };

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${phase.status === 'pending' ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] text-left"
      >
        <div className="w-6 h-6 rounded-full bg-[#1B3A2D] text-white flex items-center justify-center text-xs font-bold shrink-0">
          {phase.number}
        </div>
        <p className="text-sm font-semibold text-gray-900 flex-1">{phase.title}</p>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${statusStyles[phase.status] ?? statusStyles.pending}`}>
          {phase.status}
        </span>
        <svg className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {topAction && !expanded && (
        <div className="px-4 pb-2.5 flex items-start gap-2 -mt-1">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dotColors[topAction.priority]}`} />
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1">{topAction.text}</p>
          {topAction.annualValue ? (
            <span className="ml-auto text-xs font-bold text-emerald-700 shrink-0 tabular-nums">{fmt(topAction.annualValue)}</span>
          ) : null}
        </div>
      )}
      {expanded && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {sorted.map((action, i) => (
            <div key={i} className="px-4 py-2.5 flex items-start gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dotColors[action.priority]}`} />
              <p className="text-xs text-gray-600 leading-relaxed flex-1">{action.text}</p>
              {action.annualValue ? (
                <span className="text-xs font-bold text-emerald-700 shrink-0 tabular-nums">{fmt(action.annualValue)}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tax strategy panel ───────────────────────────────────────────────────────

function TaxStrategyPanel({ stack }: { stack: PlanData['taxStrategyStack'] }) {
  if (stack.strategies.length === 0) return null;
  return (
    <Link href="/dashboard/audit/results"
      className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4 min-h-[44px] hover:bg-gray-50 transition group">
      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Tax strategies</p>
        <p className="text-xs text-emerald-600 font-medium tabular-nums">Saving {fmt(stack.addedToDeployableCapital)}/yr</p>
      </div>
      <span className="text-gray-300 group-hover:text-gray-500 transition text-sm">→</span>
    </Link>
  );
}

// ─── REPS tracker ─────────────────────────────────────────────────────────────

function REPSTracker({ hoursLogged }: { hoursLogged: number }) {
  const pct    = Math.min(100, Math.round((hoursLogged / REPS_TARGET) * 100));
  const status = repsStatus(hoursLogged);

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4 min-h-[44px]">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">REPS Hours · {currentYear}</p>
        <p className="text-xs text-gray-400 tabular-nums">
          {Math.round(hoursLogged)} of {REPS_TARGET} hrs · <span className={status.color}>{status.label}</span>
        </p>
      </div>
      <div className="w-12 shrink-0">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-emerald-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 text-right mt-0.5">{pct}%</p>
      </div>
      <Link href="/dashboard/logs"
        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition">
        +Log Time
      </Link>
    </div>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions({ repsRelevant }: { repsRelevant: boolean }) {
  const actions = [
    { label: 'Update numbers',     sub: 'Keep plan current',          href: '/dashboard/audit',                icon: '✏️' },
    // Same gating as the REPS Hours widget elsewhere on this page — hidden entirely
    // when REPS isn't relevant yet (see computeRepsRelevance in loadData).
    ...(repsRelevant ? [{ label: 'Log REPS hours', sub: 'Material participation', href: '/dashboard/logs', icon: '⏱️' }] : []),
    { label: 'Full plan',          sub: 'Roadmap & tax',               href: '/dashboard/plan/results',         icon: '📋' },
    { label: 'Assumptions',        sub: 'Fine-tune projections',       href: '/dashboard/plan/assumptions',     icon: '🎛️' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(a => (
        <Link key={a.href} href={a.href}
          className="flex flex-col items-center text-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-5 hover:bg-gray-50 hover:border-gray-200 transition active:scale-95 min-h-[44px]">
          <span className="text-3xl">{a.icon}</span>
          <div>
            <p className="text-xs font-semibold text-gray-900 leading-tight">{a.label}</p>
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{a.sub}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Vision quote (Part 5) ────────────────────────────────────────────────────

function VisionQuote({ text, isFull }: { text: string; isFull?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // If it's a synthesized freedom statement, show it complete; otherwise truncate to first sentence
  const dotIdx = text.indexOf('.');
  const firstSentence = dotIdx > 0 ? text.slice(0, dotIdx + 1) : text.slice(0, 100);
  const preview = isFull ? text : (firstSentence.length > 100 ? firstSentence.slice(0, 100) + '…' : firstSentence);
  const hasMore = !isFull && text.length > preview.length;

  return (
    <button
      type="button"
      onClick={() => hasMore && setExpanded(e => !e)}
      className={`w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-4 ${hasMore ? 'cursor-pointer hover:bg-gray-50 transition' : 'cursor-default'}`}
    >
      <div className="flex items-start gap-3">
        <svg className="w-3.5 h-3.5 text-gray-200 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
        </svg>
        <p className="text-sm text-gray-400 italic leading-relaxed">
          {expanded ? text : preview}
        </p>
      </div>
      {hasMore && !expanded && (
        <p className="text-[10px] text-gray-300 mt-1.5 ml-6">Tap to expand</p>
      )}
    </button>
  );
}

// ─── Year in review (Part 4) ──────────────────────────────────────────────────

interface YearReviewData {
  year: number;
  completed: number;
  annualSavings: number;
  monthsMoved: number;
  visionText: string;
}

function YearInReview({ data, onDismiss }: { data: YearReviewData; onDismiss: () => void }) {
  return (
    <div className="bg-[#1B3A2D] -mx-4 sm:mx-0 sm:rounded-2xl px-5 py-6 text-white relative animate-fade-in">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition text-sm"
      >
        ✕
      </button>
      <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-4">
        Your {data.year} in MoneyXprt
      </p>
      <div className="space-y-2.5 mb-5">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold">✓</span>
          <p className="text-sm text-white">
            {data.completed} action{data.completed !== 1 ? 's' : ''} completed
          </p>
        </div>
        {data.annualSavings > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">✓</span>
            <p className="text-sm text-white">{fmt(data.annualSavings)} in annual savings activated</p>
          </div>
        )}
        {data.monthsMoved > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">✓</span>
            <p className="text-sm text-white">
              Freedom date moved {Math.round(data.monthsMoved * 10) / 10} months closer
            </p>
          </div>
        )}
      </div>
      {data.visionText && (
        <p className="text-white/50 italic text-xs leading-relaxed border-t border-white/10 pt-4">
          {data.visionText}
        </p>
      )}
    </div>
  );
}

// ─── Protection Score (Defend Part 1) ────────────────────────────────────────

function ProtectionScore({ annualSavings }: { annualSavings: number }) {
  const tenYear = Math.round(annualSavings * 14.78);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${annualSavings > 0 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
          <svg className={`w-5 h-5 ${annualSavings > 0 ? 'text-emerald-600' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">What You&apos;ve Protected</p>
          {annualSavings > 0 ? (
            <>
              <p className="text-2xl font-extrabold text-emerald-700 tabular-nums leading-none">
                {fmt(annualSavings)}<span className="text-sm font-normal text-emerald-500">/year</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">kept from unnecessary tax extraction</p>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Over 10 years, that compounds to approximately{' '}
                <span className="font-semibold text-gray-700">{fmt(tenYear)}</span>.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 leading-relaxed">
              Implement your first tax strategy to start protecting your wealth.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tax Year Deadline Alert (Defend Part 4) ──────────────────────────────────

function TaxYearDeadlineBanner({ daysLeft, unimplemented }: { daysLeft: number; unimplemented: number }) {
  return (
    <div className="-mx-4 sm:mx-0 bg-amber-50 border-b sm:border border-amber-200 sm:rounded-xl px-5 py-4">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08z" clipRule="evenodd" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">
            Tax Year Closes in {daysLeft} Day{daysLeft !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            You have {unimplemented} unimplemented {unimplemented === 1 ? 'strategy' : 'strategies'} that {unimplemented === 1 ? 'expires' : 'expire'} December 31.
            {' '}Every day you wait is money you can&apos;t recover.
          </p>
        </div>
      </div>
      <div className="mt-3 pl-8">
        <Link
          href="/dashboard/execute"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition"
        >
          See what to implement now →
        </Link>
      </div>
    </div>
  );
}

// ─── Financial phase badge ────────────────────────────────────────────────────

const PHASE_LABELS: Record<FinancialPhase, string> = {
  funding_mini_ef:  'Funding starter emergency fund',
  paying_debt:      'Paying down debt',
  building_full_ef: 'Building full emergency fund',
  assets_unlocked:  'Assets unlocked',
};

const PHASE_STYLES: Record<FinancialPhase, string> = {
  funding_mini_ef:  'bg-amber-100 text-amber-700',
  paying_debt:      'bg-amber-100 text-amber-700',
  building_full_ef: 'bg-sky-100 text-sky-700',
  assets_unlocked:  'bg-emerald-100 text-emerald-700',
};

function FinancialPhaseBadge({ phase }: { phase: FinancialPhase }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${PHASE_STYLES[phase]}`}>
      {PHASE_LABELS[phase]}
    </span>
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
  const [session, setSession]         = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loading, setLoading]         = useState(true);
  const [plan, setPlan]               = useState<PlanData | null>(null);
  const [repsHours, setRepsHours]     = useState(0);
  const [repsRelevant, setRepsRelevant] = useState(false);
  const [stale, setStale]             = useState(false);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [execNextAction, setExecNextAction] = useState<{ id: string; title: string; estimated_annual_value: number } | null>(null);
  const [execSummary, setExecSummary] = useState<{ total: number; completed: number; activatedSavings: number; thisWeekTotal: number; thisWeekDone: number } | null>(null);
  const [visionText, setVisionText]             = useState<string | null>(null);
  const [freedomStatement, setFreedomStatement] = useState<string | null>(null);
  const [yearReview, setYearReview]       = useState<YearReviewData | null>(null);
  const [financialPhase, setFinancialPhase] = useState<FinancialPhase | null>(null);
  const [unimplementedTaxCount, setUnimplementedTaxCount] = useState(0);
  const [freedomScoreBreakdown, setFreedomScoreBreakdown] = useState<FreedomScoreBreakdown | null>(null);
  const [snapshotIncome, setSnapshotIncome] = useState<{ rental: number; dividend: number }>({ rental: 0, dividend: 0 });

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
      { data: snapshotRow },
      { data: execRows },
      { data: profileRow },
      { data: assetPrefRow },
      { data: phaseRow },
    ] = await Promise.all([
      sb.from('generated_plans')
        .select('freedom_gap, phases, tax_strategy_stack, asset_roadmap, created_at')
        .eq('user_id', userId)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('material_participation_logs')
        .select('hours_logged')
        .eq('user_id', userId)
        .gte('date', `${currentYear}-01-01`)
        .lt('date', `${currentYear + 1}-01-01`),
      sb.from('financial_snapshots')
        .select('created_at, monthly_rental_income, monthly_dividend_income, currently_owns_rental')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('execution_actions')
        .select('id, title, category, estimated_annual_value, estimated_months_saved, completed, sort_order, strategy_id')
        .eq('user_id', userId)
        .order('sort_order'),
      sb.from('freedom_profiles')
        .select('vision_text, freedom_statement')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('asset_preferences')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
      sb.from('financial_phase_status')
        .select('phase')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    setFinancialPhase((phaseRow?.phase as FinancialPhase | undefined) ?? null);

    if (planRow) {
      setPlan({
        freedomGap:       planRow.freedom_gap as PlanData['freedomGap'],
        phases:           planRow.phases as PlanPhase[],
        taxStrategyStack: planRow.tax_strategy_stack as PlanData['taxStrategyStack'],
        createdAt:        planRow.created_at as string,
      });
    }

    // Same relevance check planGenerator.ts uses to gate Phase 4's REPS note (owned now,
    // or a rental acquisition projected within 2 years) — the REPS Hours widget below
    // is hidden entirely rather than shown years ahead of being relevant. Kept as a
    // local (not just the repsRelevant state, which wouldn't be readable synchronously
    // within this same call) so the "next action" pick below can filter on it too —
    // execution_actions rows can be persisted under actionGenerator.ts's own, broader
    // repsRelevant (any rental anywhere in the ~20yr roadmap, not just within 2 years),
    // so a REPS row can exist in the table even when this narrower check is false.
    const repsRelevantNow = computeRepsRelevance(
      !!snapshotRow?.currently_owns_rental,
      (planRow?.asset_roadmap as AssetRoadmapRow[] | undefined) ?? [],
    ).relevant;
    setRepsRelevant(repsRelevantNow);

    if (snapshotRow) {
      setSnapshotDate(snapshotRow.created_at as string);
      setStale(daysSince(snapshotRow.created_at as string) >= 90);
    } else if (planRow) {
      // Fall back to plan date if no snapshot date available
      setStale(daysSince(planRow.created_at as string) >= 90);
    }

    if (repsRows) {
      const total = repsRows.reduce((s, r) => s + Number(r.hours_logged ?? 0), 0);
      setRepsHours(total);
    }

    // Vision text + freedom statement
    type ProfileShape = { vision_text?: string | null; freedom_statement?: string | null };
    const visionStr    = (profileRow as ProfileShape | null)?.vision_text    ?? null;
    const statementStr = (profileRow as ProfileShape | null)?.freedom_statement ?? null;
    setVisionText(visionStr);
    setFreedomStatement(statementStr);

    // Normalise exec rows (always, even if empty)
    type ExecRow = { id: string; title: string; category: string; estimated_annual_value: number; estimated_months_saved: number; completed: boolean; sort_order: number; strategy_id?: string };
    const rows        = (execRows ?? []) as ExecRow[];
    const completedRows  = rows.filter(r => r.completed);
    const thisWeekRows   = rows.filter(r => r.category === 'this_week');

    // Unimplemented tax strategies for deadline banner
    let localUnimplemented = 0;
    if (planRow) {
      const strategies = (planRow.tax_strategy_stack as PlanData['taxStrategyStack'])?.strategies ?? [];
      const completedStratIds = new Set<string>(
        rows.filter(r => r.completed && r.strategy_id).map(r => r.strategy_id as string),
      );
      localUnimplemented = strategies.filter(s => !completedStratIds.has(s.id)).length;
      setUnimplementedTaxCount(localUnimplemented);
    }

    if (rows.length > 0) {
      const next = rows.find(r =>
        !r.completed && r.category === 'this_week' && (r.strategy_id !== 'reps' || repsRelevantNow),
      );
      if (next) {
        setExecNextAction({ id: next.id, title: next.title, estimated_annual_value: Number(next.estimated_annual_value || 0) });
      }
      setExecSummary({
        total: rows.length,
        completed: completedRows.length,
        activatedSavings: completedRows
          .filter(r => r.estimated_annual_value > 0)
          .reduce((s, r) => s + Number(r.estimated_annual_value || 0), 0),
        thisWeekTotal: thisWeekRows.length,
        thisWeekDone:  thisWeekRows.filter(r => r.completed).length,
      });

      // Year in review: trigger when >= 3 actions completed (testing mode)
      const dismissKey = `year_review_dismissed_${currentYear}`;
      if (completedRows.length >= 3 && !localStorage.getItem(dismissKey)) {
        const monthsMoved   = completedRows.reduce((s, r) => s + Number(r.estimated_months_saved || 0), 0);
        const annualSavings = completedRows.filter(r => r.estimated_annual_value > 0).reduce((s, r) => s + Number(r.estimated_annual_value || 0), 0);
        setYearReview({ year: currentYear, completed: completedRows.length, annualSavings, monthsMoved, visionText: visionStr ?? '' });
      }
    }

    // Snapshot income (for scoreboard + freedom score)
    type SnpRow = { created_at: string; monthly_rental_income?: number; monthly_dividend_income?: number } | null;
    const snp = snapshotRow as SnpRow;
    const rental   = Number(snp?.monthly_rental_income  ?? 0);
    const dividend = Number(snp?.monthly_dividend_income ?? 0);
    setSnapshotIncome({ rental, dividend });

    // Freedom score breakdown
    if (planRow) {
      const freedomGap   = planRow.freedom_gap   as PlanData['freedomGap'];
      const stratStack   = planRow.tax_strategy_stack as PlanData['taxStrategyStack'];
      const activeCount  = (stratStack?.strategies ?? []).length;
      setFreedomScoreBreakdown(calculateFreedomScore({
        hasFreedomProfile:        !!profileRow,
        hasFreedomNumber:         (freedomGap?.freedomNumberMonthly ?? 0) > 0,
        hasSnapshot:              !!snapshotRow,
        hasAssetPreferences:      !!assetPrefRow,
        hasConstraints:           !!snapshotRow,
        activeStrategies:         activeCount,
        implementedStrategies:    Math.max(0, activeCount - localUnimplemented),
        monthlyRentalIncome:      rental,
        monthlyDividendIncome:    dividend,
        currentPassiveMonthly:    freedomGap?.currentPassiveMonthly ?? 0,
        freedomNumberMonthly:     freedomGap?.freedomNumberMonthly  ?? 0,
        completedActions:         completedRows.length,
        thisWeekActionsTotal:     thisWeekRows.length,
        thisWeekActionsCompleted: thisWeekRows.filter(r => r.completed).length,
      }));
    }

    setLoading(false);
  }

  // ── Render guards ────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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

  // Deadline banner: September (month 8, 0-indexed) through December
  const isDeadlineSeason = nowMonth >= 8;
  const daysUntilDec31 = (() => {
    const now = new Date();
    const dec31 = new Date(now.getFullYear(), 11, 31);
    return Math.max(0, Math.ceil((dec31.getTime() - now.getTime()) / 86_400_000));
  })();
  const showDeadlineBanner = isDeadlineSeason && unimplementedTaxCount > 0 && !!plan;

  function dismissYearReview() {
    if (yearReview) localStorage.setItem(`year_review_dismissed_${yearReview.year}`, '1');
    setYearReview(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1B3A2D] flex items-center justify-center shrink-0">
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

        {/* Financial phase badge — top of page */}
        {financialPhase && <FinancialPhaseBadge phase={financialPhase} />}

        {/* Tax year deadline alert (Defend Part 4) — top of page */}
        {showDeadlineBanner && (
          <TaxYearDeadlineBanner daysLeft={daysUntilDec31} unimplemented={unimplementedTaxCount} />
        )}

        {/* Year in review (Feel Part 4) */}
        {yearReview && <YearInReview data={yearReview} onDismiss={dismissYearReview} />}

        {/* Stale plan banner */}
        {stale && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-800 leading-relaxed">
                Your plan is based on data from{' '}
                <strong>{snapshotDate
                  ? new Date(snapshotDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : 'over 90 days ago'
                }</strong>. Life changes — keep your plan current.
              </p>
            </div>
            <div className="flex gap-2 pl-6">
              <Link href="/dashboard/audit"
                className="flex-1 text-center py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition">
                Update my numbers
              </Link>
              <Link href="/dashboard/adjust"
                className="flex-1 text-center py-2 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-50 transition">
                Something changed
              </Link>
            </div>
          </div>
        )}

        {/* No plan */}
        {!plan && <NoPlanCard />}

        {plan && (
          <>
            {/* Next action — prefer execution action, fallback to plan phase action */}
            {(execNextAction || nextAction) && (
              <NextActionCard
                text={execNextAction?.title ?? nextAction!.text}
                annualValue={execNextAction?.estimated_annual_value ?? nextAction!.annualValue}
                showLink={!!execNextAction}
              />
            )}

            {/* Wealth scoreboard */}
            {execSummary && execSummary.total > 0 && (
              <WealthScoreboardCard
                implementedStrategies={Math.max(0, (plan.taxStrategyStack.strategies.length) - unimplementedTaxCount)}
                activeStrategies={plan.taxStrategyStack.strategies.length}
                activatedSavings={execSummary.activatedSavings}
                rental={snapshotIncome.rental}
                dividend={snapshotIncome.dividend}
              />
            )}

            {/* Freedom gap hero */}
            <FreedomGapHero plan={plan} />

            {/* Timeline entry point */}
            <Link href="/dashboard/plan/timeline"
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              See your freedom timeline →
            </Link>

            {/* Vision reminder — shows AI freedom statement if available, else vision_text */}
            {(freedomStatement || visionText) && (
              <VisionQuote
                text={freedomStatement ?? visionText!}
                isFull={!!freedomStatement}
              />
            )}

            {/* Protection score (Defend Part 1) */}
            <ProtectionScore annualSavings={execSummary?.activatedSavings ?? 0} />

            {/* Freedom Score (Acquire Part 2) */}
            {freedomScoreBreakdown && (
              <FreedomScoreCard breakdown={freedomScoreBreakdown} />
            )}

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

            {/* REPS tracker — hidden until REPS is actually relevant (rental owned or
                imminent), see computeRepsRelevance in loadData */}
            {repsRelevant && <REPSTracker hoursLogged={repsHours} />}

            {/* Quick actions */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">Quick actions</p>
              <QuickActions repsRelevant={repsRelevant} />
              <Link href="/dashboard/adjust"
                className="mt-3 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition py-2">
                Something changed in my financial situation →
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

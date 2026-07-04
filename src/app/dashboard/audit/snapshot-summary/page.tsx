'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { evaluateAll } from '@/app/lib/strategies';
import type { FinancialSnapshot, StrategyResult } from '@/app/lib/strategies';
import type { Session } from '@supabase/supabase-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtFull(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// Compute monthly take-home as (gross annual income − taxes) / 12
function computeMonthlyTakeHome(s: FinancialSnapshot): number {
  const grossAnnual =
    s.w2Income +
    s.bonusTakenAsCash +
    s.income1099 +
    s.carAllowanceAnnual +
    s.otherIncomeAnnual +
    s.spouseW2Income +
    s.spouseBusinessNetProfit +
    (s.monthlyRentalIncome * 12) +
    (s.monthlyDividendIncome * 12);
  return Math.max(0, (grossAnnual - s.currentTaxPaid) / 12);
}

function computeTotalDebt(s: FinancialSnapshot): number {
  return s.carLoanBalance + s.studentLoanBalance + s.personalLoanBalance +
         s.creditCardBalance + s.businessLoanBalance;
}

function computeGrossAnnualIncome(s: FinancialSnapshot): number {
  return s.w2Income + s.bonusTakenAsCash + s.income1099 + s.carAllowanceAnnual +
         s.otherIncomeAnnual + s.spouseW2Income + s.spouseBusinessNetProfit +
         (s.monthlyRentalIncome * 12) + (s.monthlyDividendIncome * 12);
}

function computeNetWorth(s: FinancialSnapshot): number {
  const assets = s.homeEquity + s.rentalPropertyValue + s.retirementBalance +
                 s.traditionalIraBalance + s.taxableBrokerageBalance + s.emergencyFund +
                 s.businessEquityValue;
  const liabilities = s.rentalMortgageBalance + computeTotalDebt(s);
  return assets - liabilities;
}

// ─── Card sub-components ──────────────────────────────────────────────────────

function MetricRow({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: 'green' | 'amber' | 'red' | 'neutral';
}) {
  const dot = color === 'green' ? 'bg-emerald-500' :
              color === 'amber' ? 'bg-amber-400' :
              color === 'red'   ? 'bg-red-400' : 'bg-gray-300';
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${dot}`} />
        <span className="text-xs text-gray-500 leading-relaxed">{label}</span>
      </div>
      <div className="text-right ml-4">
        <span className="text-xs font-semibold text-gray-900 tabular-nums">{value}</span>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StrategyBadge({ r }: { r: StrategyResult }) {
  const value = r.estimatedAnnualValue ?? 0;
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
      <span className="text-xs font-medium text-emerald-800">{r.name}</span>
      {value > 0 && (
        <span className="text-xs font-bold text-emerald-700 tabular-nums">{fmt(value)}/yr</span>
      )}
    </div>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SnapshotSummaryPage() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const freshParam  = searchParams.get('fresh') === 'true';

  const [session,  setSession]  = useState<Session | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [results,  setResults]  = useState<StrategyResult[]>([]);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async (s: Session) => {
    try {
      const latest = await getLatestSnapshot();
      if (!latest) {
        router.replace('/dashboard/audit');
        return;
      }
      setSnapshot(latest);
      setResults(evaluateAll(latest));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load snapshot.');
    } finally {
      setLoading(false);
    }
    void s;
  }, [router]);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) load(s); else setLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [load]);

  if (loading) return <Spinner />;

  if (!session) {
    router.replace('/dashboard/audit');
    return <Spinner />;
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-gray-600 mb-4">{error ?? 'No snapshot found.'}</p>
          <button onClick={() => router.push('/dashboard/audit')}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium">
            Return to Phase 1
          </button>
        </div>
      </div>
    );
  }

  // ── Derived metrics ────────────────────────────────────────────────────────
  const s = snapshot;

  // Card 1 — Tax opportunity
  const activeStrategies = results.filter(r => r.state === 'ACTIVE' && (r.estimatedAnnualValue ?? 0) > 0);
  const totalOpportunity = activeStrategies.reduce((sum, r) => sum + (r.estimatedAnnualValue ?? 0), 0);
  const verifyStrategies = results.filter(r => r.state === 'VERIFY');

  // Card 2 — Financial health
  const monthlySpend       = s.monthlySpend > 0 ? s.monthlySpend : s.essentialMonthlySpend + s.discretionaryMonthlySpend;
  const emergencyMonths    = monthlySpend > 0 ? s.emergencyFund / monthlySpend : 0;
  const grossAnnual        = computeGrossAnnualIncome(s);
  const totalDebt          = computeTotalDebt(s);
  const debtToIncome       = grossAnnual > 0 ? totalDebt / grossAnnual : 0;
  const effectiveTaxRate   = grossAnnual > 0 ? s.currentTaxPaid / grossAnnual : 0;
  const totalAssets        = s.homeEquity + s.rentalPropertyValue + s.retirementBalance +
                             s.traditionalIraBalance + s.taxableBrokerageBalance + s.emergencyFund + s.businessEquityValue;
  const netWorth           = computeNetWorth(s);

  const efColor: 'green' | 'amber' | 'red' = emergencyMonths >= 6 ? 'green' : emergencyMonths >= 3 ? 'amber' : 'red';
  const dtiColor: 'green' | 'amber' | 'red' = debtToIncome <= 0.2 ? 'green' : debtToIncome <= 0.4 ? 'amber' : 'red';
  const taxColor: 'green' | 'amber' | 'red' = effectiveTaxRate <= 0.2 ? 'green' : effectiveTaxRate <= 0.3 ? 'amber' : 'red';

  // Card 3 — Deployable capital
  const monthlyTakeHome  = computeMonthlyTakeHome(s);
  const monthlyEssential = s.essentialMonthlySpend;
  const monthlyDisc      = s.discretionaryMonthlySpend;
  const deployable       = Math.max(0, monthlyTakeHome - monthlyEssential - monthlyDisc);

  const nextUrl = '/dashboard/asset-preferences' + (freshParam ? '?fresh=true' : '');

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase">Phase 1 Complete</p>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Your Financial Snapshot</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-5 h-1.5 rounded-full bg-emerald-500" />
            <div className="w-5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Intro */}
        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 mb-3">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs font-semibold text-emerald-700">Phase 1 Saved</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Here&apos;s where you stand today</h1>
          <p className="text-sm text-gray-500 mt-1">Based on your current numbers, three things stood out.</p>
        </div>

        {/* ── Card 1: Tax Opportunity ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase mb-1">Card 1 of 3</p>
                <h2 className="text-sm font-bold text-gray-900">Tax Opportunity Snapshot</h2>
                <p className="text-xs text-gray-400 mt-0.5">Strategies active on your current numbers</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-700 tabular-nums">{fmt(totalOpportunity)}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">potential tax savings / year</p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-2">
            {activeStrategies.length > 0 ? (
              activeStrategies.map(r => <StrategyBadge key={r.id} r={r} />)
            ) : (
              <p className="text-xs text-gray-400 py-2">No strategies with quantified value yet — fill in more details to unlock estimates.</p>
            )}
            {verifyStrategies.length > 0 && (
              <div className="pt-2">
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1.5">Needs verification ({verifyStrategies.length})</p>
                <p className="text-xs text-gray-400">These strategies may apply — we&apos;ll refine them in Phase 2.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Card 2: Financial Health ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-50">
            <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase mb-1">Card 2 of 3</p>
            <h2 className="text-sm font-bold text-gray-900">Financial Health Assessment</h2>
            <p className="text-xs text-gray-400 mt-0.5">Key ratios from your current snapshot</p>
          </div>
          <div className="px-5 py-2">
            <MetricRow
              label="Emergency fund"
              value={`${emergencyMonths.toFixed(1)} months`}
              sub={fmtFull(s.emergencyFund) + ' liquid'}
              color={efColor}
            />
            <MetricRow
              label="Debt-to-income ratio"
              value={pct(debtToIncome)}
              sub={`${fmtFull(totalDebt)} total debt`}
              color={dtiColor}
            />
            <MetricRow
              label="Effective tax rate"
              value={pct(effectiveTaxRate)}
              sub={`${fmtFull(s.currentTaxPaid)} paid last year`}
              color={taxColor}
            />
            <MetricRow
              label="Total assets"
              value={fmtFull(totalAssets)}
              color="neutral"
            />
            <MetricRow
              label="Estimated net worth"
              value={fmtFull(netWorth)}
              color={netWorth >= 0 ? 'green' : 'red'}
            />
          </div>
          <div className="px-5 pb-4 pt-2">
            <div className="flex gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Good</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />Watch</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />Attention needed</span>
            </div>
          </div>
        </div>

        {/* ── Card 3: Deployable Capital ────────────────────────────────────── */}
        <div className="bg-[#1B3A2D] rounded-2xl border border-[#2a5040] shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-white/10">
            <p className="text-[10px] font-bold text-[#C9A84C] tracking-widest uppercase mb-1">Card 3 of 3</p>
            <h2 className="text-sm font-bold text-white">Your Deployable Capital</h2>
            <p className="text-xs text-white/60 mt-0.5">What&apos;s left each month after covering life</p>
          </div>
          <div className="px-5 py-5">
            <div className="text-center mb-5">
              <p className="text-4xl font-bold text-[#C9A84C] tabular-nums">{fmtFull(deployable)}</p>
              <p className="text-xs text-white/70 font-medium mt-1.5">per month available to deploy</p>
            </div>
            <div>
              {[
                { label: 'Estimated monthly take-home', value: fmtFull(monthlyTakeHome) },
                { label: 'Essential monthly spend',     value: `− ${fmtFull(monthlyEssential)}` },
                { label: 'Discretionary spending',      value: `− ${fmtFull(monthlyDisc)}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                  <span className="text-xs text-white/70">{label}</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-white/20 mt-1">
                <span className="text-xs font-bold text-white">Available to deploy monthly</span>
                <span className={`text-sm font-bold tabular-nums ${deployable > 0 ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                  {fmtFull(deployable)}
                </span>
              </div>
            </div>
            {deployable <= 0 && (
              <div className="mt-4 rounded-xl bg-amber-500/20 border border-amber-400/30 px-4 py-3">
                <p className="text-xs text-amber-300 font-medium">
                  Your spending equals or exceeds your take-home pay. Phase 2 will identify cash flow levers and tax strategies that can change this.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="pt-2 pb-6">
          <button type="button" onClick={() => router.push(nextUrl)}
            className="w-full py-3.5 rounded-2xl bg-[#1B3A2D] text-white text-sm font-semibold hover:bg-[#24503d] transition flex items-center justify-center gap-2">
            Continue to Phase 2 — Your Assets
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Phase 2 takes about 3 minutes and unlocks your full strategy plan.
          </p>
        </div>

      </main>
    </div>
  );
}

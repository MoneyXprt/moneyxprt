'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { generatePlan, savePlan } from '@/app/lib/planGenerator';
import type { GeneratedPlan, Phase, AssetRoadmapRow, PlanAction } from '@/app/lib/planGenerator';
import type { Session } from '@supabase/supabase-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-gray-300',
};

// ─── Missing step helper ──────────────────────────────────────────────────────

function MissingStep({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-full border-2 border-amber-300 flex items-center justify-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
        </div>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <Link href={href} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
        Complete →
      </Link>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-52 rounded-2xl bg-emerald-100 animate-pulse" />
      {[1, 2, 3].map(i => (
        <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
      ))}
    </div>
  );
}

// ─── Phase card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase }: { phase: Phase }) {
  const top3 = phase.actions.slice(0, 3);
  const totalValue = phase.actions.reduce((s, a) => s + (a.annualValue ?? 0), 0);
  const statusColors: Record<string, string> = {
    active:  'bg-emerald-100 text-emerald-700',
    pending: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {phase.number}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{phase.title}</p>
            <p className="text-xs text-gray-400 leading-tight">{phase.reason}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${statusColors[phase.status]}`}>
            {phase.status}
          </span>
          {totalValue > 0 && (
            <span className="text-xs font-semibold text-emerald-700">{fmt(totalValue)}/yr</span>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-2.5">
        {top3.map((action, i) => (
          <ActionRow key={i} action={action} />
        ))}
        {phase.actions.length > 3 && (
          <p className="text-xs text-gray-400 pl-5">+{phase.actions.length - 3} more actions</p>
        )}
      </div>
    </div>
  );
}

function ActionRow({ action }: { action: PlanAction }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[action.priority]}`} />
      <p className="text-xs text-gray-600 leading-relaxed flex-1">{action.text}</p>
      {action.annualValue ? (
        <span className="text-xs font-semibold text-emerald-700 shrink-0 tabular-nums">{fmt(action.annualValue)}</span>
      ) : null}
    </div>
  );
}

// ─── Roadmap table ────────────────────────────────────────────────────────────

function RoadmapTable({ rows, freedomTarget }: { rows: AssetRoadmapRow[]; freedomTarget: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">
          Your path to {fmt(freedomTarget)}/month passive income
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Year</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Action</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">+Income</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Total</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isFreedomRow = row.remainingGap === 0 && (i === 0 || rows[i - 1].remainingGap > 0);
              return (
                <tr
                  key={i}
                  className={`border-b border-gray-50 last:border-0 transition-colors ${
                    isFreedomRow ? 'bg-emerald-50' : 'hover:bg-gray-50/60'
                  }`}
                >
                  <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                    {row.calendarYear}
                  </td>
                  <td className="px-4 py-3 text-gray-700 leading-tight">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{row.action}</span>
                      {isFreedomRow && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide shrink-0">
                          FREEDOM
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold ${
                    row.estimatedMonthlyIncomeAdded > 0 ? 'text-emerald-600' : 'text-gray-300'
                  }`}>
                    {row.estimatedMonthlyIncomeAdded > 0 ? `+${fmt(row.estimatedMonthlyIncomeAdded)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-700 font-medium">
                    {fmt(row.cumulativeMonthlyIncome)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${
                    row.remainingGap === 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600'
                  }`}>
                    {row.remainingGap === 0 ? '✓' : fmt(row.remainingGap)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type MissingStepInfo = { label: string; href: string };

export default function PlanResultsPage() {
  const [session, setSession]       = useState<Session | null>(null);
  const [loading, setLoading]       = useState(true);
  const [plan, setPlan]             = useState<GeneratedPlan | null>(null);
  const [missing, setMissing]       = useState<MissingStepInfo[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const [narrative, setNarrative]   = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();

    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) { setLoading(false); return; }
      buildPlan(s);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function buildPlan(s: Session) {
    setLoading(true);
    setError(null);
    try {
      const sb = getBrowserSupabaseClient();
      const userId = s.user.id;

      // Fetch each source explicitly — avoids silent index-misalignment bugs
      // that arise when mixing Supabase queries ({ data }) with plain-returning
      // helpers (getLatestSnapshot) inside a single Promise.all destructure.
      const [
        { data: profileRow },
        { data: assetRows, error: assetError },
        { data: constraintsRow },
      ] = await Promise.all([
        sb.from('freedom_profiles')
          .select('vision_text, target_free_age, freedom_type, freedom_number_monthly, portfolio_target, housing, health_insurance, food, transportation, travel, kids, savings_buffer, misc')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // No .limit(), no .single() — returns every selected asset row for this user
        sb.from('asset_preferences')
          .select('asset_type')
          .eq('user_id', userId)
          .eq('selected', true),
        sb.from('user_constraints')
          .select('capital_per_year, hours_per_week, risk_tolerance, hard_constraints')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      console.log('[plan/results] assetRows:', assetRows, 'error:', assetError?.message);

      // Fetch snapshot separately (returns FinancialSnapshot | null, not { data })
      const snapshotResult = await getLatestSnapshot();

      // Validate completeness
      const gaps: MissingStepInfo[] = [];
      if (!profileRow?.freedom_type)       gaps.push({ label: 'Freedom Vision',     href: '/dashboard/freedom-vision' });
      if (!Number(profileRow?.freedom_number_monthly ?? 0)) gaps.push({ label: 'Freedom Number', href: '/dashboard/freedom-calculator' });
      if (!snapshotResult)                  gaps.push({ label: 'Financial Snapshot', href: '/dashboard/audit' });
      if (!assetRows?.length)               gaps.push({ label: 'Asset Preferences',  href: '/dashboard/asset-preferences' });
      if (!constraintsRow)                  gaps.push({ label: 'Constraints',         href: '/dashboard/constraints' });

      if (gaps.length > 0) {
        setMissing(gaps);
        setLoading(false);
        return;
      }

      // Assemble inputs
      const snapshot = snapshotResult!;
      const freedomNumberMonthly = Number(profileRow!.freedom_number_monthly);
      const inputs = {
        freedomProfile: {
          visionText:    profileRow!.vision_text ?? null,
          targetFreeAge: Number(profileRow!.target_free_age),
          freedomType:   profileRow!.freedom_type as 'never_work' | 'work_optional' | 'lower_stress',
        },
        freedomNumber: {
          monthlyTarget:  freedomNumberMonthly,
          portfolioTarget: Number(profileRow!.portfolio_target),
          breakdown: {
            housing:        Number(profileRow!.housing),
            health_insurance: Number(profileRow!.health_insurance),
            food:           Number(profileRow!.food),
            transportation: Number(profileRow!.transportation),
            travel:         Number(profileRow!.travel),
            kids:           Number(profileRow!.kids),
            savings_buffer: Number(profileRow!.savings_buffer),
            misc:           Number(profileRow!.misc),
          },
        },
        snapshot,
        assetPreferences: (assetRows ?? []).map(r => r.asset_type as string),
        constraints: {
          capitalPerYear:  Number(constraintsRow!.capital_per_year),
          hoursPerWeek:    Number(constraintsRow!.hours_per_week),
          riskTolerance:   constraintsRow!.risk_tolerance as string,
          hardConstraints: (constraintsRow!.hard_constraints as string[]) ?? [],
        },
      };

      // Generate + save
      const generated = generatePlan(inputs);
      setPlan(generated);

      // Save async — don't block rendering on save failure
      savePlan(generated, userId).catch(e => console.warn('savePlan failed:', e));

      // Narrative: fire async, never block plan display
      setNarrativeLoading(true);
      fetch('/api/generate-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freedomVision:           profileRow!.vision_text ?? '',
          freedomNumber:           generated.freedomGap.freedomNumberMonthly,
          currentPassiveIncome:    generated.freedomGap.currentPassiveMonthly,
          gapMonthly:              generated.freedomGap.gapMonthly,
          projectedFreedomYear:    generated.freedomGap.projectedFreedomYear,
          deployableCapitalPerYear: generated.deployableCapitalPerYear,
          taxStrategyAnnualValue:  generated.taxStrategyStack.annualValue,
          phases:                  generated.phases,
          assetRoadmap:            generated.assetRoadmap.slice(0, 5),
          freedomType:             profileRow!.freedom_type,
          targetFreeAge:           Number(profileRow!.target_free_age),
        }),
      })
        .then(r => r.json())
        .then(({ narrative: n }: { narrative: string | null }) => setNarrative(n))
        .catch(() => setNarrative(null))
        .finally(() => setNarrativeLoading(false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate your plan.');
    } finally {
      setLoading(false);
    }
  }

  // ── Auth redirect ────────────────────────────────────────────────────────
  if (!loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sign in to see your plan.</p>
          <Link href="/dashboard" className="text-emerald-600 font-semibold hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Your Plan</span>
          </div>
          <button
            onClick={() => getBrowserSupabaseClient().auth.signOut()}
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      {loading && <Skeleton />}

      {!loading && missing.length > 0 && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Complete your profile to generate a plan</h2>
            <p className="text-sm text-gray-500 mb-5">The following steps are needed before we can build your personalised plan:</p>
            <div className="divide-y divide-gray-50">
              {missing.map(s => <MissingStep key={s.href} label={s.label} href={s.href} />)}
            </div>
          </div>
        </main>
      )}

      {!loading && error && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-700">{error}</div>
        </main>
      )}

      {!loading && plan && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* ── Section 1: Freedom Gap Hero ───────────────────────────── */}
          <div className="bg-emerald-600 rounded-2xl p-6 text-white">
            <p className="text-sm font-semibold text-emerald-200 uppercase tracking-wide mb-4">Your Freedom Plan</p>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-emerald-200">Freedom Number</span>
                <span className="text-base font-bold tabular-nums">{fmt(plan.freedomGap.freedomNumberMonthly)}/mo</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-emerald-200">Current Passive Income</span>
                <span className="text-base font-semibold tabular-nums">{fmt(plan.freedomGap.currentPassiveMonthly)}/mo</span>
              </div>
              <div className="flex justify-between items-center border-t border-emerald-500 pt-2">
                <span className="text-sm text-emerald-200">Gap to Close</span>
                <span className="text-base font-bold text-amber-300 tabular-nums">{fmt(plan.freedomGap.gapMonthly)}/mo</span>
              </div>
            </div>

            {/* Projected year */}
            <div className="text-center py-4">
              <p className="text-4xl font-extrabold tracking-tight">
                {plan.freedomGap.yearsToFreedom === 0 ? 'Free Now' : plan.freedomGap.projectedFreedomYear}
              </p>
              <p className="text-emerald-300 text-sm mt-1">
                {plan.freedomGap.yearsToFreedom === 0
                  ? 'Your passive income already covers your freedom number.'
                  : `Projected freedom year — ${plan.freedomGap.yearsToFreedom} years from now`}
              </p>
            </div>

            {/* Progress bar */}
            {plan.freedomGap.freedomNumberMonthly > 0 && (
              <div>
                <div className="h-2 bg-emerald-700/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.round((plan.freedomGap.currentPassiveMonthly / plan.freedomGap.freedomNumberMonthly) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-emerald-300 mt-1.5 text-center">
                  {Math.min(100, Math.round((plan.freedomGap.currentPassiveMonthly / plan.freedomGap.freedomNumberMonthly) * 100))}% of your freedom gap closed
                </p>
              </div>
            )}
          </div>

          {/* ── Narrative card ────────────────────────────────────────── */}
          {narrativeLoading && (
            <div className="bg-white rounded-2xl border-l-4 border-emerald-500 border border-gray-100 shadow-sm px-6 py-5 space-y-3">
              <div className="h-3.5 rounded-full bg-gray-100 animate-pulse w-1/3" />
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-3 rounded-full bg-gray-100 animate-pulse w-11/12" />
                <div className="h-3 rounded-full bg-gray-100 animate-pulse w-5/6" />
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 rounded-full bg-gray-100 animate-pulse w-full" />
                <div className="h-3 rounded-full bg-gray-100 animate-pulse w-10/12" />
                <div className="h-3 rounded-full bg-gray-100 animate-pulse w-11/12" />
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 rounded-full bg-gray-100 animate-pulse w-11/12" />
                <div className="h-3 rounded-full bg-gray-100 animate-pulse w-4/6" />
              </div>
            </div>
          )}
          {!narrativeLoading && narrative && (
            <div className="bg-white rounded-2xl border-l-4 border-emerald-500 border border-gray-100 shadow-sm px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Plan, In Plain Language</h2>
              <div className="space-y-4">
                {narrative.split('\n\n').filter(p => p.trim()).map((paragraph, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">{paragraph.trim()}</p>
                ))}
              </div>
            </div>
          )}

          {/* ── Section 2: Phase cards ────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-0.5">Your roadmap</p>
            <div className="space-y-3">
              {plan.phases.map(phase => <PhaseCard key={phase.number} phase={phase} />)}
            </div>
          </div>

          {/* ── Section 3: Tax strategy stack ────────────────────────── */}
          {plan.taxStrategyStack.strategies.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-900">
                  Adding {fmt(plan.taxStrategyStack.addedToDeployableCapital)}/year to your asset-building capacity
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Tax savings redirected from the IRS to your investment engine
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {plan.taxStrategyStack.strategies.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-gray-700">{r.name}</span>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums shrink-0 ml-3">
                      {fmt(r.estimatedAnnualValue)}/yr
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-emerald-50/60">
                  <span className="text-sm font-semibold text-gray-900">Total added to plan</span>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(plan.taxStrategyStack.addedToDeployableCapital)}/yr</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 4: Asset roadmap ──────────────────────────────── */}
          {plan.assetRoadmap.length > 0 && (
            <RoadmapTable rows={plan.assetRoadmap} freedomTarget={plan.freedomGap.freedomNumberMonthly} />
          )}

          {/* ── Section 5: CTA ────────────────────────────────────────── */}
          <div className="pb-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 transition"
            >
              Start executing your plan →
            </Link>
            <p className="mt-2 text-center text-xs text-gray-400">
              Estimates are illustrative. Consult a financial advisor before making investment decisions.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}

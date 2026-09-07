'use client';

import { useState, useEffect, useRef } from 'react';
import { Tooltip } from '@/components/Tooltip';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { generateBaselinePlan, savePlan } from '@/app/lib/planGenerator';
import { generateActions, saveActions } from '@/app/lib/actionGenerator';
import type { GeneratedPlan, Phase, AssetRoadmapRow, PlanAction } from '@/app/lib/planGenerator';
import type { BonusPlan } from '@/app/lib/deployableCapital';
import type { FinancialPhase } from '@/app/lib/financialPhase';
import type { SimulatableDebt } from '@/app/lib/debtPayoff';
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
  const [expanded, setExpanded] = useState(false);
  const top3 = phase.actions.slice(0, 3);
  const rest = phase.actions.slice(3);
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
        {expanded && rest.map((action, i) => (
          <ActionRow key={i + 3} action={action} />
        ))}
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-gray-400 pl-5 hover:text-gray-600"
          >
            {expanded ? 'Show less' : `+${rest.length} more actions`}
          </button>
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

type MilestoneRow = { isMilestone: true; label: string; pct: number; key: string };
type TableRow = AssetRoadmapRow | MilestoneRow;

function buildTableRows(rows: AssetRoadmapRow[], target: number): TableRow[] {
  const thresholds = [
    { pct: 0.25, label: '25% of your freedom gap closed' },
    { pct: 0.50, label: 'Halfway to financial freedom' },
    { pct: 0.75, label: '75% of the way there' },
  ];
  const result: TableRow[] = [];
  let ti = 0;
  for (const row of rows) {
    while (ti < thresholds.length && row.cumulativeMonthlyIncome >= target * thresholds[ti].pct) {
      result.push({ isMilestone: true, label: thresholds[ti].label, pct: thresholds[ti].pct, key: `ms-${thresholds[ti].pct}` });
      ti++;
    }
    result.push(row);
  }
  return result;
}

function RoadmapTable({ rows, freedomTarget }: { rows: AssetRoadmapRow[]; freedomTarget: number }) {
  const tableRows = buildTableRows(rows, freedomTarget);

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
            {tableRows.map((row, i) => {
              if ('isMilestone' in row) {
                return (
                  <tr key={row.key} className="bg-emerald-50/60 border-b border-emerald-100">
                    <td colSpan={5} className="px-4 py-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                        <span style={{ fontSize: '11px' }}>★</span>
                        {row.label}
                      </span>
                    </td>
                  </tr>
                );
              }

              const isRentalRow = (row.action?.toLowerCase().includes('rental') || row.assetType?.toLowerCase().includes('rental')) ?? false;
              const isFreedomRow = row.remainingGap === 0;

              return (
                <tr
                  key={i}
                  className={`border-b border-gray-50 last:border-0 transition-colors ${
                    isFreedomRow
                      ? 'bg-emerald-50'
                      : isRentalRow
                      ? 'bg-amber-50/30'
                      : 'hover:bg-gray-50/60'
                  }`}
                >
                  <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">
                    {row.calendarYear}
                  </td>
                  <td className="px-4 py-3 text-gray-700 leading-tight">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isRentalRow && !isFreedomRow && (
                        <span style={{ color: '#C9A84C', fontSize: '11px', lineHeight: 1 }}>★</span>
                      )}
                      <span>{row.action}</span>
                      {isFreedomRow && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide shrink-0">
                          FREEDOM
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap ${
                    row.estimatedMonthlyIncomeAdded > 0
                      ? 'tabular-nums font-semibold text-emerald-600'
                      : 'text-gray-500 italic'
                  }`}>
                    {row.estimatedMonthlyIncomeAdded > 0 ? `+${fmt(row.estimatedMonthlyIncomeAdded)}` : 'Accumulating'}
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

// ─── Vision moment card ───────────────────────────────────────────────────────

function VisionMomentCard({ visionText, message, suffix }: {
  visionText: string;
  message: string;
  suffix?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border-l-4 border-l-emerald-500 border border-gray-100 shadow-sm px-5 py-5 animate-fade-in">
      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Your Vision</p>
      <p className="text-sm text-gray-600 italic leading-relaxed mb-3">&ldquo;{visionText}&rdquo;</p>
      <p className="text-sm text-gray-800">{message}</p>
      {suffix && <p className="mt-2 text-xs font-bold text-[#C9A84C]">{suffix}</p>}
    </div>
  );
}

// ─── Plan comparison ──────────────────────────────────────────────────────────

interface PreviousPlanData {
  freedomGap: {
    projectedFreedomYear: number;
    gapMonthly: number;
    freedomNumberMonthly: number;
    currentPassiveMonthly: number;
    yearsToFreedom: number;
  };
  deployableCapitalPerYear: number;
  taxStrategyStack: {
    strategies: Array<{ id: string; name: string; estimatedAnnualValue: number }>;
    addedToDeployableCapital: number;
    annualValue: number;
  };
}

function generateChangeExplanation(prev: PreviousPlanData, next: GeneratedPlan): string[] {
  const lines: string[] = [];
  const yearDelta = prev.freedomGap.projectedFreedomYear - next.freedomGap.projectedFreedomYear;
  const capDelta  = next.deployableCapitalPerYear - prev.deployableCapitalPerYear;
  const prevStrategyIds = new Set(prev.taxStrategyStack.strategies.map(s => s.id));
  const newStrategies   = next.taxStrategyStack.strategies.filter(s => !prevStrategyIds.has(s.id));

  if (yearDelta > 0) {
    lines.push(
      `Your freedom date moved ${yearDelta} year${yearDelta !== 1 ? 's' : ''} earlier. Higher deployable capital means assets are acquired sooner, and passive income starts compounding earlier — each year of early gains compounds forward through the rest of the roadmap.`,
    );
  } else if (yearDelta < 0) {
    lines.push(
      `Your freedom date moved ${Math.abs(yearDelta)} year${Math.abs(yearDelta) !== 1 ? 's' : ''} later. This typically happens when your freedom number increased or your capital deployment rate decreased — both extend how long it takes your passive income to reach your target.`,
    );
  }

  if (capDelta > 50) {
    const yearGrowth = Math.round(capDelta * Math.pow(1.07, 10));
    lines.push(
      `Your deployable capital increased from ${fmt(prev.deployableCapitalPerYear)} to ${fmt(next.deployableCapitalPerYear)}/yr (+${fmt(capDelta)}/yr). Compounded at 7% for 10 years, that additional capital is worth ${fmt(yearGrowth)} — and it starts flowing into your asset engine immediately.`,
    );
  } else if (capDelta < -50) {
    lines.push(
      `Your deployable capital decreased by ${fmt(Math.abs(capDelta))}/yr. This directly slows asset acquisition and pushes your freedom date later.`,
    );
  }

  for (const s of newStrategies) {
    lines.push(
      `${s.name} became available because you now meet its eligibility criteria. This adds ${fmt(s.estimatedAnnualValue)}/yr to your plan — capital that goes directly into your asset-building engine and has been incorporated into your new freedom date.`,
    );
  }

  return lines;
}

function PlanDeltaCard({ prev, next }: { prev: PreviousPlanData; next: GeneratedPlan }) {
  const [showWhy, setShowWhy] = useState(false);
  const yearDelta = prev.freedomGap.projectedFreedomYear - next.freedomGap.projectedFreedomYear;
  const gapDelta  = prev.freedomGap.gapMonthly - next.freedomGap.gapMonthly;
  const capDelta  = next.deployableCapitalPerYear - prev.deployableCapitalPerYear;

  const prevStrategyIds = new Set(prev.taxStrategyStack.strategies.map(s => s.id));
  const newStrategies   = next.taxStrategyStack.strategies.filter(s => !prevStrategyIds.has(s.id));

  const hasChanges = yearDelta !== 0 || Math.abs(gapDelta) > 1 || Math.abs(capDelta) > 50 || newStrategies.length > 0;
  if (!hasChanges) return null;

  const explanations = generateChangeExplanation(prev, next);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">What changed in your plan</p>
      </div>
      <div className="divide-y divide-gray-50">
        {yearDelta !== 0 && (
          <div className="px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Freedom date</p>
            <p className={`text-sm font-bold tabular-nums ${yearDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {prev.freedomGap.projectedFreedomYear} → {next.freedomGap.projectedFreedomYear}
              {' '}
              <span className="font-normal text-xs">
                ({Math.abs(yearDelta)} yr{Math.abs(yearDelta) !== 1 ? 's' : ''} {yearDelta > 0 ? 'earlier' : 'later'})
              </span>
            </p>
          </div>
        )}
        {Math.abs(gapDelta) > 1 && (
          <div className="px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Monthly gap</p>
            <p className={`text-sm font-bold tabular-nums ${gapDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {fmt(prev.freedomGap.gapMonthly)} → {fmt(next.freedomGap.gapMonthly)}/mo
            </p>
          </div>
        )}
        {Math.abs(capDelta) > 50 && (
          <div className="px-5 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Annual capital deployment</p>
            <p className={`text-sm font-bold tabular-nums ${capDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {capDelta > 0 ? '+' : ''}{fmt(capDelta)}/yr
            </p>
          </div>
        )}
        {newStrategies.length > 0 && (
          <div className="px-5 py-3 space-y-1.5">
            <p className="text-xs text-gray-500">Newly unlocked strategies</p>
            {newStrategies.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-700 font-medium">{s.name} — {fmt(s.estimatedAnnualValue)}/yr</p>
              </div>
            ))}
          </div>
        )}
        {explanations.length > 0 && (
          <div className="px-5 py-3">
            <button
              type="button"
              onClick={() => setShowWhy(e => !e)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition font-medium"
            >
              <svg className={`w-3 h-3 transition-transform ${showWhy ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              Why did this change?
            </button>
            {showWhy && (
              <div className="mt-3 space-y-2.5">
                {explanations.map((line, i) => (
                  <p key={i} className="text-xs text-gray-600 leading-relaxed">{line}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type MissingStepInfo = { label: string; href: string };

export default function PlanResultsPage() {
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(true);
  const [plan, setPlan]               = useState<GeneratedPlan | null>(null);
  const [previousPlan, setPreviousPlan] = useState<PreviousPlanData | null>(null);
  const [missing, setMissing]         = useState<MissingStepInfo[]>([]);
  const [error, setError]             = useState<string | null>(null);
  const [narrative, setNarrative]     = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [isPartnerView, setIsPartnerView] = useState(false);
  const [primaryUserId, setPrimaryUserId] = useState<string | null>(null);
  const [refreshingPartnerPlan, setRefreshingPartnerPlan] = useState(false);
  const [refreshPartnerError, setRefreshPartnerError]     = useState<string | null>(null);
  const [visionText, setVisionText]   = useState<string | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const actionsSaved = useRef(false);

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

      // Check if this user is a partner on someone else's plan
      const { data: primaryProfile } = await sb
        .from('freedom_profiles')
        .select('user_id')
        .eq('partner_user_id', userId)
        .eq('partner_accepted', true)
        .maybeSingle();

      if (primaryProfile) {
        setIsPartnerView(true);
        setPrimaryUserId(primaryProfile.user_id);
        // Fetch the primary user's current plan (RLS allows this via partner policy)
        const { data: planRow } = await sb
          .from('generated_plans')
          .select('freedom_gap, phases, tax_strategy_stack, asset_roadmap, deployable_capital_per_year')
          .eq('user_id', primaryProfile.user_id)
          .eq('is_current', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!planRow) {
          setError("Your partner hasn't generated their plan yet. Ask them to visit the Plan tab first.");
          setLoading(false);
          return;
        }

        const partnerPlan: GeneratedPlan = {
          freedomGap:               planRow.freedom_gap as GeneratedPlan['freedomGap'],
          phases:                   planRow.phases as GeneratedPlan['phases'],
          taxStrategyStack:         planRow.tax_strategy_stack as GeneratedPlan['taxStrategyStack'],
          assetRoadmap:             planRow.asset_roadmap as GeneratedPlan['assetRoadmap'],
          deployableCapitalPerYear: Number(planRow.deployable_capital_per_year),
          aiNarrative:              null,
        };
        setPlan(partnerPlan);
        setLoading(false);
        return;
      }

      const [
        { data: profileRow },
        { data: assetRows },
        { data: constraintsRow },
        { data: prevPlanRow },
        { data: bonusPlanRow },
        { data: phaseRow },
        { data: debtRows },
      ] = await Promise.all([
        sb.from('freedom_profiles')
          .select('vision_text, target_free_age, freedom_type, freedom_number_monthly, portfolio_target, housing, health_insurance, food, transportation, travel, kids, savings_buffer, misc')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb.from('asset_preferences')
          .select('asset_type')
          .eq('user_id', userId)
          .eq('selected', true),
        sb.from('user_constraints')
          .select('capital_per_year, hours_per_week, risk_tolerance, hard_constraints')
          .eq('user_id', userId)
          .maybeSingle(),
        // Fetch the current plan before we overwrite it — used for the "what changed" diff + narrative reuse
        sb.from('generated_plans')
          .select('freedom_gap, deployable_capital_per_year, tax_strategy_stack, ai_narrative, ai_narrative_debt_total, ai_narrative_projected_tax_total')
          .eq('user_id', userId)
          .eq('is_current', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb.from('bonus_plan')
          .select('frequency, plan_amount, payment_month')
          .eq('user_id', userId)
          .maybeSingle(),
        sb.from('financial_phase_status')
          .select('phase')
          .eq('user_id', userId)
          .maybeSingle(),
        sb.from('debts')
          .select('id, name, current_balance, interest_rate, is_active')
          .eq('user_id', userId)
          .eq('is_active', true),
      ]);

      const bonusPlan: BonusPlan | null = bonusPlanRow ? {
        frequency:    bonusPlanRow.frequency as BonusPlan['frequency'],
        planAmount:   Number(bonusPlanRow.plan_amount),
        paymentMonth: bonusPlanRow.payment_month,
      } : null;

      const financialPhase = (phaseRow?.phase as FinancialPhase | undefined) ?? null;
      const debts: SimulatableDebt[] = (debtRows ?? []).map(d => ({
        id:            d.id,
        name:          d.name,
        currentBalance: Number(d.current_balance),
        interestRate:  Number(d.interest_rate),
        isActive:      d.is_active,
      }));

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
        financialPhase,
        debts,
      };

      // Capture previous plan for diff before savePlan retires it
      if (prevPlanRow) {
        setPreviousPlan({
          freedomGap:              prevPlanRow.freedom_gap as PreviousPlanData['freedomGap'],
          deployableCapitalPerYear: Number(prevPlanRow.deployable_capital_per_year),
          taxStrategyStack:        prevPlanRow.tax_strategy_stack as PreviousPlanData['taxStrategyStack'],
        });
      }

      // Generate + save
      const generated = generateBaselinePlan(inputs);
      setPlan(generated);

      // Vision text for emotional moments
      setVisionText(profileRow?.vision_text ?? null);

      // Freedom date milestones — shown once per threshold per browser
      const thisYear   = new Date().getFullYear();
      const yearsLeft  = generated.freedomGap.projectedFreedomYear - thisYear;
      if (yearsLeft <= 5 && !localStorage.getItem('milestone_shown_5')) {
        setMilestoneBanner('5 years or less. This is real.');
        localStorage.setItem('milestone_shown_5', '1');
      } else if (yearsLeft <= 10 && !localStorage.getItem('milestone_shown_10')) {
        setMilestoneBanner("Under 10 years. You're in rare company.");
        localStorage.setItem('milestone_shown_10', '1');
      } else if (yearsLeft <= 15 && !localStorage.getItem('milestone_shown_15')) {
        setMilestoneBanner("You're within 15 years of freedom. Most people never get this close.");
        localStorage.setItem('milestone_shown_15', '1');
      }

      // Save plan — awaited so we have the inserted row's id to target the later
      // narrative-persistence update (rendering already happened via setPlan above).
      let planId: string | null = null;
      try {
        planId = await savePlan(generated, userId);
      } catch (e) {
        console.warn('savePlan failed:', e);
      }

      // Regenerate execution actions — once per page mount, not on every render
      if (!actionsSaved.current) {
        actionsSaved.current = true;
        const execActions = generateActions(generated, snapshot, 0, bonusPlan, financialPhase);
        saveActions(execActions, userId).catch(e => console.warn('saveActions failed:', e));
      }

      // Narrative: only call OpenAI when the plan has changed meaningfully
      const savedNarrative    = (prevPlanRow as { ai_narrative?: string | null } | null)?.ai_narrative ?? null;
      const savedFreedomYear  = (prevPlanRow?.freedom_gap as { projectedFreedomYear?: number } | null)?.projectedFreedomYear;
      const savedCapital      = Number(prevPlanRow?.deployable_capital_per_year ?? 0);
      const savedDebtTotal    = (prevPlanRow as { ai_narrative_debt_total?: number | null } | null)?.ai_narrative_debt_total ?? null;
      const savedProjectedTaxTotal = (prevPlanRow as { ai_narrative_projected_tax_total?: number | null } | null)?.ai_narrative_projected_tax_total ?? null;
      const newFreedomYear    = generated.freedomGap.projectedFreedomYear;
      const newCapital        = generated.deployableCapitalPerYear;
      const newDebtTotal      = debts.reduce((sum, d) => sum + d.currentBalance, 0);
      const newProjectedTaxTotal = generated.taxStrategyStack.strategies
        .filter(r => r.valueType === 'projected')
        .reduce((sum, r) => sum + r.estimatedAnnualValue, 0);

      const needsNewNarrative =
        !savedNarrative ||
        savedFreedomYear !== newFreedomYear ||
        Math.abs(newCapital - savedCapital) > 1000 ||
        savedDebtTotal === null ||
        Math.abs(newDebtTotal - savedDebtTotal) > 500 ||
        savedProjectedTaxTotal === null ||
        Math.abs(newProjectedTaxTotal - savedProjectedTaxTotal) > 50;

      if (!needsNewNarrative) {
        setNarrative(savedNarrative);
      } else {
        setNarrativeLoading(true);
        fetch('/api/generate-narrative', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
          body: JSON.stringify({
            freedomVision:            profileRow!.vision_text ?? '',
            freedomNumber:            generated.freedomGap.freedomNumberMonthly,
            currentPassiveIncome:     generated.freedomGap.currentPassiveMonthly,
            gapMonthly:               generated.freedomGap.gapMonthly,
            projectedFreedomYear:     newFreedomYear,
            deployableCapitalPerYear: newCapital,
            taxStrategyAnnualValue:   generated.taxStrategyStack.annualValue,
            projectedTaxStrategyAnnualValue: newProjectedTaxTotal,
            phases:                   generated.phases,
            assetRoadmap:             generated.assetRoadmap.slice(0, 5),
            freedomType:              profileRow!.freedom_type,
            targetFreeAge:            Number(profileRow!.target_free_age),
            totalActiveDebt:          newDebtTotal,
          }),
        })
          .then(r => r.json())
          .then(({ narrative: n }: { narrative: string | null }) => {
            setNarrative(n);
            if (n && planId) {
              sb.from('generated_plans')
                .update({ ai_narrative: n, ai_narrative_debt_total: newDebtTotal, ai_narrative_projected_tax_total: newProjectedTaxTotal })
                .eq('id', planId)
                .then(({ error }) => { if (error) console.warn('persist ai_narrative failed:', error.message); });
            }
          })
          .catch(() => setNarrative(null))
          .finally(() => setNarrativeLoading(false));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate your plan.');
    } finally {
      setLoading(false);
    }
  }

  // ── Partner-triggered refresh (explicit only — never automatic from viewing) ──
  async function handleRefreshPartnerPlan() {
    if (!session || !primaryUserId || refreshingPartnerPlan) return;
    setRefreshingPartnerPlan(true);
    setRefreshPartnerError(null);
    try {
      const response = await fetch('/api/regenerate-partner-plan', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ primaryUserId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(err.error ?? `Server error ${response.status}`);
      }
      // Re-fetch to reflect the freshly-regenerated plan (this re-reads the same
      // read-only generated_plans row this view already displays from).
      await buildPlan(session);
    } catch (e) {
      setRefreshPartnerError(e instanceof Error ? e.message : 'Refresh failed. Please try again.');
    } finally {
      setRefreshingPartnerPlan(false);
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

      {/* Plan tab bar */}
      <div className="bg-white border-b border-gray-100 sticky top-14 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex">
            {([
              { label: 'Plan',        href: '/dashboard/plan/results' },
              { label: 'Timeline ✨', href: '/dashboard/plan/timeline' },
              { label: 'Assumptions', href: '/dashboard/plan/assumptions' },
            ] as const).map(tab => (
              <Link key={tab.href} href={tab.href}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  tab.href === '/dashboard/plan/results'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}>
                {tab.label}
              </Link>
            ))}
          </div>
          <Link href="/dashboard/cpa-report"
            className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition whitespace-nowrap">
            Export CPA Packet →
          </Link>
        </div>
      </div>

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

          {/* ── Partner banner ────────────────────────────────────────── */}
          {isPartnerView && (
            <div className="bg-purple-50 border border-purple-100 rounded-2xl px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏠</span>
                <div>
                  <p className="text-sm font-semibold text-purple-900">Your shared path to freedom</p>
                  <p className="text-xs text-purple-600 mt-0.5">You&apos;re viewing your household&apos;s freedom plan. Head to Execute to check off your actions.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefreshPartnerPlan}
                disabled={refreshingPartnerPlan}
                className="w-full py-2 rounded-xl border border-purple-200 bg-white text-purple-700 text-xs font-semibold hover:bg-purple-50 disabled:opacity-60 transition"
              >
                {refreshingPartnerPlan ? 'Refreshing…' : "Refresh my partner's action list"}
              </button>
              {refreshPartnerError && (
                <p className="text-xs text-red-600">{refreshPartnerError}</p>
              )}
            </div>
          )}

          {/* ── Milestone celebration banner (Part 2) ─────────────────── */}
          {milestoneBanner && (
            <div className="bg-emerald-600 -mx-4 sm:mx-0 sm:rounded-2xl px-5 py-5 text-white text-center animate-fade-in">
              <p className="text-base font-bold leading-snug">{milestoneBanner}</p>
            </div>
          )}

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
                <span className="flex items-center gap-1 text-sm text-emerald-200">
                  Gap to Close
                  <Tooltip content={`Your freedom gap is the monthly passive income you still need to build. It closes as you acquire assets. Right now you need ${fmt(plan.freedomGap.gapMonthly)}/mo more — the roadmap below shows the year-by-year path to closing it completely.`} />
                </span>
                <span className="text-base font-bold text-amber-300 tabular-nums">{fmt(plan.freedomGap.gapMonthly)}/mo</span>
              </div>
            </div>

            {/* Projected year */}
            <div className="text-center py-4">
              <p className="text-4xl font-extrabold tracking-tight">
                {plan.freedomGap.yearsToFreedom === 0 ? 'Free Now' : plan.freedomGap.projectedFreedomYear}
              </p>
              <p className="text-emerald-300 text-sm mt-1 flex items-center justify-center gap-1">
                {plan.freedomGap.yearsToFreedom === 0
                  ? 'Your passive income already covers your freedom number.'
                  : `Projected freedom year — ${plan.freedomGap.yearsToFreedom} years from now`}
                <Tooltip content="Your projected freedom year is calculated by modeling how long it takes your asset income to equal your freedom number, given your current capital deployment rate, tax savings, and selected asset engines. Move the levers in Plan Assumptions to see it change." />
              </p>
            </div>

            {/* Progress bar */}
            {plan.freedomGap.freedomNumberMonthly > 0 && (() => {
              const pct = Math.min(100, Math.round((plan.freedomGap.currentPassiveMonthly / plan.freedomGap.freedomNumberMonthly) * 100));
              return (
                <div>
                  <div className="h-2 bg-emerald-700/60 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-emerald-300 mt-1.5 text-center flex items-center justify-center gap-1">
                    {pct}% of your freedom gap closed
                    <Tooltip content={`This bar fills as your passive income grows relative to your freedom number. At 100% you're free. Right now you're generating ${pct}% of what you need — ${fmt(plan.freedomGap.currentPassiveMonthly)}/mo of ${fmt(plan.freedomGap.freedomNumberMonthly)}/mo.`} />
                  </p>
                </div>
              );
            })()}
          </div>

          {/* ── Vision moment cards (Part 1) ─────────────────────────── */}
          {/* First time seeing a plan */}
          {!previousPlan && visionText && plan && (
            <VisionMomentCard
              visionText={visionText}
              message={`This is what you're building toward. Your plan puts you there in ${plan.freedomGap.yearsToFreedom} year${plan.freedomGap.yearsToFreedom !== 1 ? 's' : ''}.`}
            />
          )}
          {/* Freedom date moved closer */}
          {previousPlan && plan && visionText &&
            (previousPlan.freedomGap.projectedFreedomYear - plan.freedomGap.projectedFreedomYear) > 0 && (
            <VisionMomentCard
              visionText={visionText}
              message={`You just got ${(previousPlan.freedomGap.projectedFreedomYear - plan.freedomGap.projectedFreedomYear) * 12} months closer to that day.`}
              suffix="Keep going."
            />
          )}

          {/* ── What changed card ────────────────────────────────────── */}
          {previousPlan && plan && (
            <PlanDeltaCard prev={previousPlan} next={plan} />
          )}

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
          {plan.taxStrategyStack.strategies.length > 0 && (() => {
            const cashStrategies      = plan.taxStrategyStack.strategies.filter(r => r.valueType === 'cash');
            const projectedStrategies = plan.taxStrategyStack.strategies.filter(r => r.valueType === 'projected');
            const projectedTotal      = projectedStrategies.reduce((sum, r) => sum + r.estimatedAnnualValue, 0);
            return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  {fmt(plan.deployableCapitalPerYear)}/yr deployable capital
                  <Tooltip content={`This is how much you can invest toward assets each year. It combines your stated capital (${fmt(plan.deployableCapitalPerYear - plan.taxStrategyStack.addedToDeployableCapital)}/yr) plus your identified cash tax savings (${fmt(plan.taxStrategyStack.addedToDeployableCapital)}/yr from ACTIVE strategies). Tax savings directly accelerate asset acquisition.`} />
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Including {fmt(plan.taxStrategyStack.addedToDeployableCapital)}/yr in cash tax savings redirected to your investment engine
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {cashStrategies.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-gray-700">{r.name}</span>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums shrink-0 ml-3">
                      {fmt(r.estimatedAnnualValue)}/yr
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-emerald-50/60">
                  <span className="text-sm font-semibold text-gray-900">Cash tax savings this year</span>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums">{fmt(plan.taxStrategyStack.addedToDeployableCapital)}/yr</span>
                </div>
                {projectedStrategies.length > 0 && (<>
                  {projectedStrategies.map(r => (
                    <div key={r.id} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-gray-700">{r.name}</span>
                      <span className="text-sm font-bold text-indigo-600 tabular-nums shrink-0 ml-3">
                        {fmt(r.estimatedAnnualValue)}/yr <span className="text-indigo-400 font-normal">(projected)</span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-5 py-3 bg-indigo-50/60">
                    <span className="text-sm font-semibold text-gray-900">Long-term value from tax-advantaged growth</span>
                    <span className="text-sm font-bold text-indigo-600 tabular-nums">{fmt(projectedTotal)}/yr</span>
                  </div>
                </>)}
                {(plan.taxStrategyStack.rentalTaxUnlockAnnualValue ?? 0) > 0 && (
                  <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50/70 border-t border-amber-100">
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      +{fmt(plan.taxStrategyStack.rentalTaxUnlockAnnualValue!)}/yr available once you acquire your first rental — not included above, but added to the roadmap automatically the year after acquisition
                    </p>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* ── Section 4: Asset roadmap ──────────────────────────────── */}
          {plan.assetRoadmap.length > 0 && (
            <RoadmapTable rows={plan.assetRoadmap} freedomTarget={plan.freedomGap.freedomNumberMonthly} />
          )}

          {/* ── Adjust assumptions CTA ────────────────────────────────── */}
          <Link
            href="/dashboard/plan/assumptions"
            className="flex items-center justify-between w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 hover:bg-gray-50 transition group"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">Adjust assumptions &amp; run scenarios</p>
              <p className="text-xs text-gray-400 mt-0.5">Fine-tune income projections and see how your freedom date changes</p>
            </div>
            <span className="text-emerald-600 font-bold text-sm shrink-0 ml-3 group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>

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

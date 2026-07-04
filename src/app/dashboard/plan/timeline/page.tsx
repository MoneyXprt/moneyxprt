'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { generatePlan } from '@/app/lib/planGenerator';
import { calculateMilestones } from '@/app/lib/milestoneCalculator';
import { FreedomTimeline } from '@/components/FreedomTimeline';
import type { GeneratedPlan, IncomeAssumptions, PlanInputs } from '@/app/lib/planGenerator';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';
import type { Milestone } from '@/app/lib/milestoneCalculator';
import type { Session } from '@supabase/supabase-js';

// ─── Row types ────────────────────────────────────────────────────────────────

interface ProfileRow {
  freedom_number_monthly: number;
  vision_text:   string | null;
  target_free_age: number;
  freedom_type:  string;
}
interface ConstraintsRow {
  capital_per_year:  number;
  hours_per_week:    number;
  risk_tolerance:    string;
  hard_constraints:  unknown;
}
interface AssumptionsRow {
  spouse_business_monthly_12:  number;
  spouse_business_monthly_36:  number;
  digital_products_monthly_12: number;
  digital_products_monthly_36: number;
  digital_products_peak:       number;
  first_rental_delay_years:    number;
  bonus_growth_rate:           number;
}
interface ExecRow {
  id: string; title: string; category: string; completed: boolean; sort_order: number;
}

// ─── Lever state ──────────────────────────────────────────────────────────────

interface Levers {
  monthlyCapital:        number;
  spouseBusinessMonthly: number;
  digitalProductsMonthly: number;
  freedomNumber:         number;
  bonusGrowthRate:       number;   // 0–20 (%)
  firstRentalYear:       number | null; // null = not planning
}

function leversFromData(
  constraints: ConstraintsRow | null,
  assumptions: AssumptionsRow | null,
  profile: ProfileRow | null,
  plan: GeneratedPlan | null,
  currentYear: number,
): Levers {
  const firstRentalRow = plan?.assetRoadmap.find(r => r.assetType === 'long_term_rental');
  const firstRentalDelayYears = assumptions?.first_rental_delay_years ?? (firstRentalRow ? Math.max(0, firstRentalRow.year - 1) : 2);
  return {
    monthlyCapital:        (constraints?.capital_per_year ?? 41000) / 12,
    spouseBusinessMonthly: assumptions?.spouse_business_monthly_12 ?? 0,
    digitalProductsMonthly: assumptions?.digital_products_monthly_12 ?? 0,
    freedomNumber:         profile?.freedom_number_monthly ?? 14200,
    bonusGrowthRate:       Math.round((assumptions?.bonus_growth_rate ?? 0) * 100),
    firstRentalYear:       currentYear + firstRentalDelayYears + 1,
  };
}

// ─── Input builders ───────────────────────────────────────────────────────────

function buildInputs(
  profile: ProfileRow,
  snapshot: FinancialSnapshot,
  assetPrefs: string[],
  constraints: ConstraintsRow,
  levers: Levers,
): PlanInputs {
  const prefs = levers.firstRentalYear === null
    ? assetPrefs.filter(p => p !== 'long_term_rental')
    : assetPrefs;
  return {
    freedomProfile: {
      visionText:    profile.vision_text ?? null,
      targetFreeAge: Number(profile.target_free_age),
      freedomType:   profile.freedom_type as 'never_work' | 'work_optional' | 'lower_stress',
    },
    freedomNumber: {
      monthlyTarget:   levers.freedomNumber,
      portfolioTarget: levers.freedomNumber * 300,
      breakdown:       {},
    },
    snapshot,
    assetPreferences: prefs,
    constraints: {
      capitalPerYear:  levers.monthlyCapital * 12,
      hoursPerWeek:    Number(constraints.hours_per_week),
      riskTolerance:   constraints.risk_tolerance,
      hardConstraints: (constraints.hard_constraints as string[]) ?? [],
    },
  };
}

function buildIncomeAssumptions(
  assumptions: AssumptionsRow | null,
  levers: Levers,
  currentYear: number,
): IncomeAssumptions {
  const delayYears = levers.firstRentalYear !== null
    ? Math.max(0, levers.firstRentalYear - currentYear - 1)
    : 50;
  return {
    businessMonthly12:       0,
    businessMonthly36:       0,
    spouseBusinessMonthly12: levers.spouseBusinessMonthly,
    spouseBusinessMonthly36: levers.spouseBusinessMonthly * 1.5,
    digitalProductsMonthly12: levers.digitalProductsMonthly,
    digitalProductsMonthly36: assumptions?.digital_products_monthly_36 ?? levers.digitalProductsMonthly * 3,
    digitalProductsPeak:      assumptions?.digital_products_peak ?? levers.digitalProductsMonthly * 5,
    firstRentalDelayYears:    delayYears,
    bonusGrowthRate:          levers.bonusGrowthRate / 100,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtM = (n: number) =>
  n >= 10000 ? `$${(n / 1000).toFixed(0)}k` :
  n >= 1000  ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString()}`;

const fmtFull = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanTabBar() {
  return (
    <div className="bg-white border-b border-gray-100 sticky top-14 z-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="flex">
          {[
            { label: 'Plan',        href: '/dashboard/plan/results' },
            { label: 'Timeline ✨', href: '/dashboard/plan/timeline' },
            { label: 'Assumptions', href: '/dashboard/plan/assumptions' },
          ].map(tab => {
            const active = tab.href === '/dashboard/plan/timeline';
            return (
              <Link key={tab.href} href={tab.href}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                  active
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="h-52 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

function FreedomDateCard({
  savedPlan, livePlan, targetFreeAge, leversModified,
}: {
  savedPlan: GeneratedPlan; livePlan: GeneratedPlan | null;
  targetFreeAge: number; leversModified: boolean;
}) {
  const saved     = savedPlan.freedomGap.projectedFreedomYear;
  const live      = livePlan?.freedomGap.projectedFreedomYear ?? saved;
  const yearDelta = saved - live; // Bug 3: positive = live is EARLIER = better
  const yearsBack = Math.max(0, 65 - targetFreeAge); // Bug 2: years gained vs. working to 65

  const rightCol = (
    <div className="border-l border-gray-100 pl-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        vs. Working Until 65
      </p>
      <p className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: '#C9A84C' }}>
        {yearsBack}
      </p>
      <p className="text-xs text-gray-400 mt-1.5 leading-snug">years back from default path</p>
    </div>
  );

  if (!leversModified) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Your Freedom Date
            </p>
            <p className="text-3xl font-extrabold tabular-nums text-gray-900 mt-1">{saved}</p>
            <p className="text-xs text-gray-400 mt-1.5">free at {targetFreeAge}</p>
          </div>
          {rightCol}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Your Freedom Date
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xs text-gray-400">Saved:</span>
            <span className="text-base font-bold text-gray-700 tabular-nums">{saved}</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
            <span className="text-xs text-gray-400">Adjusted:</span>
            <span className={`text-xl font-extrabold tabular-nums transition-colors ${
              live < saved ? 'text-emerald-600' : live > saved ? 'text-amber-600' : 'text-gray-900'
            }`}>{live}</span>
            {yearDelta !== 0 && (
              <span className={`text-xs font-semibold ${yearDelta > 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {yearDelta > 0 ? `${yearDelta}yr earlier` : `${Math.abs(yearDelta)}yr later`}
              </span>
            )}
          </div>
        </div>
        {rightCol}
      </div>
    </div>
  );
}

function LeverCard({
  label, value, onChange, min, max, step, display, impact, direction, savedHint, note,
  minLabel, maxLabel,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  display: string; impact?: string; direction?: 'up' | 'down' | 'neutral';
  savedHint?: string; note?: string;
  minLabel?: string; maxLabel?: string;
}) {
  const dirIcon = direction === 'up'   ? <span className="text-emerald-500 font-bold text-xs">↑</span>
                : direction === 'down' ? <span className="text-amber-500 font-bold text-xs">↓</span>
                :                        <span className="text-gray-300 font-bold text-xs">→</span>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex justify-between items-start mb-1">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        {direction && dirIcon}
      </div>
      {savedHint && <p className="text-[10px] text-gray-400 mb-2">{savedHint}</p>}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 mb-1 rounded-full"
        style={{ accentColor: '#1B3A2D' }}
      />
      {/* Bug 8 — range labels */}
      {(minLabel || maxLabel) && (
        <div className="flex justify-between mb-2.5">
          <span className="text-[9px] text-gray-300 tabular-nums">{minLabel}</span>
          <span className="text-[9px] text-gray-300 tabular-nums">{maxLabel}</span>
        </div>
      )}
      <p className="text-xl font-extrabold text-emerald-600 tabular-nums leading-none mb-1.5">
        {display}
      </p>
      {impact && <p className="text-[10px] text-gray-500 leading-snug">{impact}</p>}
      {note && <p className="text-[10px] text-gray-400 mt-1 italic">{note}</p>}
    </div>
  );
}

function RentalDropdown({
  value, onChange, currentYear,
}: {
  value: number | null; onChange: (v: number | null) => void; currentYear: number;
}) {
  const options = [
    ...([0, 1, 2, 3, 4].map(d => ({ value: currentYear + d, label: String(currentYear + d) }))),
    { value: null as number | null, label: 'Not planning a rental' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-bold text-gray-700 mb-3">First Rental Timeline</p>
      <select
        value={value ?? 'none'}
        onChange={e => onChange(e.target.value === 'none' ? null : Number(e.target.value))}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
      >
        {options.map(opt => (
          <option key={opt.value ?? 'none'} value={opt.value ?? 'none'}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ConfirmDialog({
  changedRows, saving, onConfirm, onCancel,
}: {
  changedRows: Array<{ label: string; from: string; to: string }>;
  saving: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-base font-bold text-gray-900 mb-1">Update your plan?</h2>
        <p className="text-xs text-gray-400 mb-4">Only changed values are shown below.</p>
        <div className="space-y-2.5 mb-5">
          {changedRows.map(row => (
            <div key={row.label} className="flex justify-between items-center text-xs">
              <span className="text-gray-500">{row.label}</span>
              <span className="text-gray-800 font-semibold tabular-nums">
                {row.from} → {row.to}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
            {saving ? 'Saving…' : 'Confirm'}
          </button>
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  const [session, setSession]           = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loading, setLoading]           = useState(false);
  const [noPlan, setNoPlan]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Loaded data
  const [snapshot, setSnapshot]         = useState<FinancialSnapshot | null>(null);
  const [savedPlan, setSavedPlan]       = useState<GeneratedPlan | null>(null);
  const [profile, setProfile]           = useState<ProfileRow | null>(null);
  const [constraints, setConstraints]   = useState<ConstraintsRow | null>(null);
  const [assumptions, setAssumptions]   = useState<AssumptionsRow | null>(null);
  const [assetPrefs, setAssetPrefs]     = useState<string[]>([]);
  const [execRows, setExecRows]         = useState<ExecRow[]>([]);
  const [hasAssumptions, setHasAssumptions] = useState(false);

  // Live / recalculated
  const [milestones, setMilestones]     = useState<Milestone[]>([]);
  const [livePlan, setLivePlan]         = useState<GeneratedPlan | null>(null);
  const [isRecalculating, setRecalculating] = useState(false);

  // Levers
  const [levers, setLevers]             = useState<Levers>({
    monthlyCapital: 3416, spouseBusinessMonthly: 0, digitalProductsMonthly: 0,
    freedomNumber: 14200, bonusGrowthRate: 0, firstRentalYear: currentYear + 2,
  });
  const [savedLevers, setSavedLevers]   = useState<Levers | null>(null);
  const [leversModified, setLeversModified] = useState(false);

  // Save flow
  const [saving, setSaving]             = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) loadData(s);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data load ─────────────────────────────────────────────────────────────
  async function loadData(s: Session) {
    setLoading(true);
    const sb     = getBrowserSupabaseClient();
    const userId = s.user.id;

    try {
      const [
        { data: profileRow },
        { data: assetRows },
        { data: constraintsRow },
        { data: assumptionsRow },
        { data: planRow },
        { data: actionRows },
      ] = await Promise.all([
        sb.from('freedom_profiles')
          .select('freedom_number_monthly, vision_text, target_free_age, freedom_type')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('asset_preferences')
          .select('asset_type').eq('user_id', userId).eq('selected', true),
        sb.from('user_constraints')
          .select('capital_per_year, hours_per_week, risk_tolerance, hard_constraints')
          .eq('user_id', userId).maybeSingle(),
        sb.from('plan_assumptions')
          .select('spouse_business_monthly_12, spouse_business_monthly_36, digital_products_monthly_12, digital_products_monthly_36, digital_products_peak, first_rental_delay_years, bonus_growth_rate')
          .eq('user_id', userId).maybeSingle(),
        sb.from('generated_plans')
          .select('freedom_gap, asset_roadmap, phases, tax_strategy_stack, deployable_capital_per_year')
          .eq('user_id', userId).eq('is_current', true)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('execution_actions')
          .select('id, title, category, completed, sort_order')
          .eq('user_id', userId).order('sort_order'),
      ]);

      const snap = await getLatestSnapshot();

      if (!planRow) { setNoPlan(true); setLoading(false); return; }

      const plan: GeneratedPlan = {
        freedomGap:               planRow.freedom_gap as GeneratedPlan['freedomGap'],
        phases:                   planRow.phases as GeneratedPlan['phases'],
        taxStrategyStack:         planRow.tax_strategy_stack as GeneratedPlan['taxStrategyStack'],
        assetRoadmap:             (planRow.asset_roadmap as GeneratedPlan['assetRoadmap']) ?? [],
        deployableCapitalPerYear: Number(planRow.deployable_capital_per_year),
        aiNarrative:              null,
      };

      const prof  = profileRow  as ProfileRow  | null;
      const cons  = constraintsRow as ConstraintsRow | null;
      const asmp  = assumptionsRow as AssumptionsRow | null;
      const rows  = (actionRows ?? []) as ExecRow[];
      const prefs = (assetRows ?? []).map(r => r.asset_type as string);

      const initLevers = leversFromData(cons, asmp, prof, plan, currentYear);

      setSavedPlan(plan);
      setProfile(prof);
      setConstraints(cons);
      setAssumptions(asmp);
      setHasAssumptions(!!asmp);
      setAssetPrefs(prefs);
      setExecRows(rows);
      setSnapshot(snap);
      setLevers(initLevers);
      setSavedLevers(initLevers);
      setLivePlan(plan);

      // Initial milestones from saved plan
      const completedTitles  = rows.filter(r => r.completed).map(r => r.title);
      const thisYearActions  = rows.filter(r => r.category === 'this_year' && !r.completed);
      setMilestones(calculateMilestones(
        plan, snap ?? { monthlySpend: 0, emergencyFund: 0 } as unknown as FinancialSnapshot,
        initLevers.monthlyCapital * 12, currentYear,
        Number(prof?.target_free_age ?? 50), completedTitles, thisYearActions,
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline data.');
    } finally {
      setLoading(false);
    }
  }

  // ── Recalculation engine (debounced) ──────────────────────────────────────
  useEffect(() => {
    if (!savedPlan || !profile || !constraints || !snapshot || !leversModified) return;

    setRecalculating(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        const inputs      = buildInputs(profile, snapshot, assetPrefs, constraints, levers);
        const incomeAsmp  = buildIncomeAssumptions(assumptions, levers, currentYear);
        const newPlan     = generatePlan(inputs, incomeAsmp);
        const completedTitles = execRows.filter(r => r.completed).map(r => r.title);
        const thisYearActions = execRows.filter(r => r.category === 'this_year' && !r.completed);
        const newMilestones   = calculateMilestones(
          newPlan, snapshot, levers.monthlyCapital * 12, currentYear,
          Number(profile.target_free_age), completedTitles, thisYearActions,
        );
        setLivePlan(newPlan);
        setMilestones(newMilestones);
      } catch {
        // recalculation error — keep previous milestones
      } finally {
        setRecalculating(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levers]);

  // ── Lever update ──────────────────────────────────────────────────────────
  const setLever = useCallback(<K extends keyof Levers>(key: K, val: Levers[K]) => {
    setLeversModified(true);
    setLevers(prev => ({ ...prev, [key]: val }));
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!savedLevers || !savedPlan) return;
    setLevers(savedLevers);
    setLeversModified(false);
    setLivePlan(savedPlan);
  }, [savedLevers, savedPlan]);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!session || !savedLevers) return;
    setSaving(true);
    const sb     = getBrowserSupabaseClient();
    const userId = session.user.id;

    try {
      const updates: PromiseLike<unknown>[] = [];

      if (
        constraints &&
        Math.round(levers.monthlyCapital * 12) !== Math.round(savedLevers.monthlyCapital * 12)
      ) {
        updates.push(
          sb.from('user_constraints')
            .update({ capital_per_year: Math.round(levers.monthlyCapital * 12) })
            .eq('user_id', userId),
        );
      }

      if (profile && levers.freedomNumber !== savedLevers.freedomNumber) {
        updates.push(
          sb.from('freedom_profiles')
            .update({ freedom_number_monthly: levers.freedomNumber })
            .eq('user_id', userId),
        );
      }

      updates.push(
        sb.from('plan_assumptions').upsert({
          user_id:                    userId,
          spouse_business_monthly_12: levers.spouseBusinessMonthly,
          spouse_business_monthly_36: Math.round(levers.spouseBusinessMonthly * 1.5),
          digital_products_monthly_12: levers.digitalProductsMonthly,
          digital_products_monthly_36: assumptions?.digital_products_monthly_36 ?? levers.digitalProductsMonthly * 3,
          digital_products_peak:       assumptions?.digital_products_peak ?? levers.digitalProductsMonthly * 5,
          first_rental_delay_years:    levers.firstRentalYear !== null
            ? Math.max(0, levers.firstRentalYear - currentYear - 1)
            : 50,
          bonus_growth_rate:           levers.bonusGrowthRate / 100,
        }, { onConflict: 'user_id' }),
      );

      await Promise.all(updates);
      setSavedLevers(levers);
      setShowConfirm(false);
      router.push('/dashboard/plan/results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  // ── Derived impact values ─────────────────────────────────────────────────
  const savedFreedomYear  = savedPlan?.freedomGap.projectedFreedomYear ?? currentYear + 10;
  const liveFreedomYear   = livePlan?.freedomGap.projectedFreedomYear  ?? savedFreedomYear;
  // Bug 3 fix: positive monthDelta = live year is EARLIER = good
  const monthDelta        = (savedFreedomYear - liveFreedomYear) * 12;
  const portfolioTarget   = levers.freedomNumber * 300;
  const liveFirstRental   = livePlan?.assetRoadmap.find(r => r.assetType === 'long_term_rental');
  const savedFirstRental  = savedPlan?.assetRoadmap.find(r => r.assetType === 'long_term_rental');
  const rentalShift       = (liveFirstRental?.calendarYear ?? 0) - (savedFirstRental?.calendarYear ?? 0);
  const bonusYear5Cap     = snapshot ? Math.round(snapshot.bonusIncome * (Math.pow(1 + levers.bonusGrowthRate / 100, 5) - 1)) : 0;

  // All direction indicators follow plan impact (monthDelta), not lever delta
  // Bug 3 fix: direction is based on whether live plan is EARLIER (↑) or later (↓)
  const leverDirection: 'up' | 'down' | 'neutral' = !leversModified ? 'neutral'
    : monthDelta > 0 ? 'up' : monthDelta < 0 ? 'down' : 'neutral';

  const globalImpact: string | undefined = !leversModified ? undefined
    : monthDelta > 0 ? `Freedom date moves ${Math.abs(monthDelta)} month${Math.abs(monthDelta) !== 1 ? 's' : ''} earlier`
    : monthDelta < 0 ? `Freedom date moves ${Math.abs(monthDelta)} month${Math.abs(monthDelta) !== 1 ? 's' : ''} later`
    : 'No change to your freedom date';

  // ── Confirm dialog changed rows ───────────────────────────────────────────
  const fmtCurrency = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const changedRows = (() => {
    if (!savedLevers) return [];
    const rows: Array<{ label: string; from: string; to: string }> = [];
    if (Math.abs(levers.monthlyCapital - savedLevers.monthlyCapital) > 1)
      rows.push({ label: 'Monthly capital', from: `${fmtCurrency(savedLevers.monthlyCapital)}/mo`, to: `${fmtCurrency(levers.monthlyCapital)}/mo` });
    if (levers.spouseBusinessMonthly !== savedLevers.spouseBusinessMonthly)
      rows.push({ label: 'Partner income', from: `${fmtCurrency(savedLevers.spouseBusinessMonthly)}/mo`, to: `${fmtCurrency(levers.spouseBusinessMonthly)}/mo` });
    if (levers.digitalProductsMonthly !== savedLevers.digitalProductsMonthly)
      rows.push({ label: 'Business revenue', from: `${fmtCurrency(savedLevers.digitalProductsMonthly)}/mo`, to: `${fmtCurrency(levers.digitalProductsMonthly)}/mo` });
    if (levers.freedomNumber !== savedLevers.freedomNumber)
      rows.push({ label: 'Freedom number', from: `${fmtCurrency(savedLevers.freedomNumber)}/mo`, to: `${fmtCurrency(levers.freedomNumber)}/mo` });
    if (levers.bonusGrowthRate !== savedLevers.bonusGrowthRate)
      rows.push({ label: 'Bonus growth rate', from: `${savedLevers.bonusGrowthRate}%`, to: `${levers.bonusGrowthRate}%` });
    if (levers.firstRentalYear !== savedLevers.firstRentalYear)
      rows.push({ label: 'First rental', from: savedLevers.firstRentalYear?.toString() ?? 'None', to: levers.firstRentalYear?.toString() ?? 'None' });
    return rows;
  })();

  // ── Guards ────────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sign in to view your timeline.</p>
          <Link href="/dashboard" className="text-emerald-600 font-semibold hover:underline">← Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <span className="text-sm text-gray-500">Timeline</span>
          </div>
          <button onClick={() => getBrowserSupabaseClient().auth.signOut()}
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition">
            Sign out
          </button>
        </div>
      </header>

      <PlanTabBar />

      {loading && <Skeleton />}

      {!loading && error && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 text-sm text-red-700">{error}</div>
        </main>
      )}

      {!loading && noPlan && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-2xl mb-3">📊</p>
            <h2 className="text-base font-bold text-gray-900 mb-2">Build your plan first</h2>
            <p className="text-sm text-gray-500 mb-5">
              Your freedom timeline will appear here once you generate your first plan.
            </p>
            <Link href="/dashboard/plan"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
              Build my plan →
            </Link>
          </div>
        </main>
      )}

      {!loading && savedPlan && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-12">

          {/* Timeline chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Freedom Timeline
              </p>
              {isRecalculating && (
                <span className="text-[10px] text-amber-500 font-semibold animate-pulse">
                  Recalculating…
                </span>
              )}
            </div>
            <FreedomTimeline
              milestones={milestones}
              currentYear={currentYear}
              freedomYear={liveFreedomYear}
              isRecalculating={isRecalculating}
            />
          </div>

          {/* Freedom date summary */}
          <FreedomDateCard
            savedPlan={savedPlan}
            livePlan={livePlan}
            targetFreeAge={Number(profile?.target_free_age ?? 50)}
            leversModified={leversModified}
          />

          {/* Levers section header */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-0.5">
              Move the levers — watch your timeline shift
            </p>
            {!hasAssumptions && (
              <p className="text-[10px] text-gray-400 mb-3 px-0.5">Using your saved plan values</p>
            )}
          </div>

          {/* Lever 1 — Monthly capital */}
          <LeverCard
            label="Monthly capital toward assets"
            value={levers.monthlyCapital}
            onChange={v => setLever('monthlyCapital', v)}
            min={0} max={10000} step={100}
            display={`$${Math.round(levers.monthlyCapital).toLocaleString()}/mo → $${Math.round(levers.monthlyCapital * 12).toLocaleString()}/yr`}
            savedHint={`Currently saved: $${Math.round(savedLevers?.monthlyCapital ?? levers.monthlyCapital).toLocaleString()}/month`}
            direction={leverDirection}
            impact={globalImpact}
            minLabel="$0"
            maxLabel="$10,000/mo"
          />

          {/* Lever 2 — Partner business income */}
          <LeverCard
            label="Partner business income"
            value={levers.spouseBusinessMonthly}
            onChange={v => setLever('spouseBusinessMonthly', v)}
            min={0} max={5000} step={50}
            display={`$${Math.round(levers.spouseBusinessMonthly).toLocaleString()}/mo`}
            savedHint={`Currently saved: $${Math.round(savedLevers?.spouseBusinessMonthly ?? 0).toLocaleString()}/month`}
            direction={leverDirection}
            impact={!leversModified ? undefined :
              liveFirstRental && rentalShift !== 0
                ? `First rental moves ${Math.abs(rentalShift)} year${Math.abs(rentalShift) !== 1 ? 's' : ''} ${rentalShift < 0 ? 'earlier' : 'later'} (${liveFirstRental.calendarYear})`
                : globalImpact}
            minLabel="$0"
            maxLabel="$5,000/mo"
          />

          {/* Lever 3 — Your business revenue */}
          <LeverCard
            label="Your business revenue"
            value={levers.digitalProductsMonthly}
            onChange={v => setLever('digitalProductsMonthly', v)}
            min={0} max={15000} step={500}
            display={`$${Math.round(levers.digitalProductsMonthly).toLocaleString()}/mo`}
            savedHint={`Currently saved: $${Math.round(savedLevers?.digitalProductsMonthly ?? 0).toLocaleString()}/month`}
            direction={leverDirection}
            impact={globalImpact}
            minLabel="$0"
            maxLabel="$15,000/mo"
          />

          {/* Lever 4 — Freedom number */}
          <LeverCard
            label="Freedom number"
            value={levers.freedomNumber}
            onChange={v => setLever('freedomNumber', v)}
            min={5000} max={25000} step={500}
            display={`$${Math.round(levers.freedomNumber).toLocaleString()}/mo needed → ${fmtFull(portfolioTarget)} portfolio`}
            savedHint={`Currently saved: $${Math.round(savedLevers?.freedomNumber ?? levers.freedomNumber).toLocaleString()}/month`}
            direction={leverDirection}
            impact={globalImpact}
            minLabel="$5,000/mo"
            maxLabel="$25,000/mo"
          />

          {/* Lever 5 — Bonus growth rate */}
          <LeverCard
            label="Bonus growth rate"
            value={levers.bonusGrowthRate}
            onChange={v => setLever('bonusGrowthRate', v)}
            min={0} max={20} step={1}
            display={`${levers.bonusGrowthRate}% per year`}
            savedHint={`Currently saved: ${savedLevers?.bonusGrowthRate ?? 0}% per year`}
            direction={leverDirection}
            impact={bonusYear5Cap > 0 ? `+$${Math.round(bonusYear5Cap).toLocaleString()} additional capital by year 5 vs. flat bonus` : undefined}
            minLabel="0%"
            maxLabel="20%"
          />

          {/* Lever 6 — First rental year (dropdown) */}
          <RentalDropdown
            value={levers.firstRentalYear}
            onChange={v => setLever('firstRentalYear', v)}
            currentYear={currentYear}
          />

          {/* Save / Reset */}
          <div className="space-y-2 pt-2">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={saving || isRecalculating || changedRows.length === 0}
              className="w-full py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-40">
              {changedRows.length > 0 ? `Save as my plan (${changedRows.length} change${changedRows.length !== 1 ? 's' : ''})` : 'No changes to save'}
            </button>
            {changedRows.length > 0 && (
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-500 font-semibold text-sm hover:bg-gray-50 transition">
                Reset to saved values
              </button>
            )}
          </div>

        </main>
      )}

      {showConfirm && (
        <ConfirmDialog
          changedRows={changedRows}
          saving={saving}
          onConfirm={handleSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

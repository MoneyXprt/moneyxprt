'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { generateBaselinePlan, generatePreviewPlan } from '@/app/lib/planGenerator';
import { generateActions, saveActions } from '@/app/lib/actionGenerator';
import { computeMonthlyDeployable } from '@/app/lib/deployableCapital';
import type { GeneratedPlan, PlanInputs, IncomeAssumptions } from '@/app/lib/planGenerator';
import type { BonusPlan } from '@/app/lib/deployableCapital';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';
import type { FinancialPhase } from '@/app/lib/financialPhase';
import type { SimulatableDebt } from '@/app/lib/debtPayoff';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  visionText: string | null;
  targetFreeAge: number;
  freedomType: 'never_work' | 'work_optional' | 'lower_stress';
  monthlyTarget: number;
  portfolioTarget: number;
  breakdown: Record<string, number>;
}

interface ConstraintsData {
  capitalPerYear: number;
  hoursPerWeek: number;
  riskTolerance: string;
  hardConstraints: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function fmtM(n: number) {
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-6 rounded-full bg-gray-200 animate-pulse w-2/3" />
      <div className="h-4 rounded-full bg-gray-100 animate-pulse w-1/2" />
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

// ─── Currency input ────────────────────────────────────────────────────────────

function CurrencyInput({
  value, onChange, placeholder,
}: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <div className="relative mt-1">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
      <input
        type="number"
        min="0"
        value={value || ''}
        placeholder={placeholder ?? '0'}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-full pl-6 pr-2 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition tabular-nums bg-white"
      />
    </div>
  );
}

// ─── Income projection row ────────────────────────────────────────────────────

function IncomeProjectionRow({
  label, helper, currentMonthly, month12, month36, onMonth12, onMonth36,
}: {
  label: string; helper: string; currentMonthly: number;
  month12: number; month36: number;
  onMonth12: (v: number) => void; onMonth36: (v: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{helper}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Now</p>
          <p className="mt-2 text-sm font-semibold text-gray-400 tabular-nums">{fmt(currentMonthly)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">In 12 mo</p>
          <CurrencyInput value={month12} onChange={onMonth12} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">In 36 mo</p>
          <CurrencyInput value={month36} onChange={onMonth36} />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AssumptionsPage() {
  const router = useRouter();
  const [session, setSession]   = useState<Session | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Loaded data
  const [snapshot, setSnapshot]         = useState<FinancialSnapshot | null>(null);
  const [assetPrefs, setAssetPrefs]     = useState<string[]>([]);
  const [profile, setProfile]           = useState<ProfileData | null>(null);
  const [constraints, setConstraints]   = useState<ConstraintsData | null>(null);
  const [defaultPlan, setDefaultPlan]   = useState<GeneratedPlan | null>(null);
  const [financialPhase, setFinancialPhase] = useState<FinancialPhase | null>(null);
  const [debts, setDebts]               = useState<SimulatableDebt[]>([]);

  // Section 1 — Income projections
  const [bizMonthly12, setBizMonthly12]         = useState(0);
  const [bizMonthly36, setBizMonthly36]         = useState(0);
  const [spouseMonthly12, setSpouseMonthly12]   = useState(500);
  const [spouseMonthly36, setSpouseMonthly36]   = useState(1_500);
  const [digitalMonthly12, setDigitalMonthly12] = useState(1_000);
  const [digitalMonthly36, setDigitalMonthly36] = useState(5_000);

  // Section 2 — Levers
  const [capitalPerYearLever, setCapitalPerYearLever]   = useState(30_000);
  const [freedomNumberLever, setFreedomNumberLever]     = useState(10_000);
  const [digitalPeakLever, setDigitalPeakLever]         = useState(5_000);
  const [firstRentalDelayYears, setFirstRentalDelayYears] = useState(0);
  const [bonusGrowthPct, setBonusGrowthPct]             = useState(0); // 0–20 integer percent
  const [discretionaryCutLever, setDiscretionaryCutLever] = useState(0); // $/mo reduction, preview only

  // Live recalculation
  const [livePlan, setLivePlan] = useState<GeneratedPlan | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track which levers have been moved from default
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const touch = useCallback((id: string) => {
    setTouched(prev => { const s = new Set(prev); s.add(id); return s; });
  }, []);

  // ── Auth + data load ────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) { setLoading(false); return; }
      loadData(s);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadData(s: Session) {
    setLoading(true);
    try {
      const sb = getBrowserSupabaseClient();
      const uid = s.user.id;

      const [
        { data: profileRow },
        { data: assetRows },
        { data: constraintsRow },
        { data: savedAssumptions },
        { data: phaseRow },
        { data: debtRows },
      ] = await Promise.all([
        sb.from('freedom_profiles')
          .select('vision_text,target_free_age,freedom_type,freedom_number_monthly,portfolio_target,housing,health_insurance,food,transportation,travel,kids,savings_buffer,misc')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb.from('asset_preferences')
          .select('asset_type')
          .eq('user_id', uid)
          .eq('selected', true),
        sb.from('user_constraints')
          .select('capital_per_year,hours_per_week,risk_tolerance,hard_constraints')
          .eq('user_id', uid)
          .maybeSingle(),
        sb.from('plan_assumptions')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle(),
        sb.from('financial_phase_status')
          .select('phase')
          .eq('user_id', uid)
          .maybeSingle(),
        sb.from('debts')
          .select('id, name, current_balance, interest_rate, is_active')
          .eq('user_id', uid)
          .eq('is_active', true),
      ]);

      const fetchedPhase = (phaseRow?.phase as FinancialPhase | undefined) ?? null;
      const fetchedDebts: SimulatableDebt[] = (debtRows ?? []).map(d => ({
        id:            d.id,
        name:          d.name,
        currentBalance: Number(d.current_balance),
        interestRate:  Number(d.interest_rate),
        isActive:      d.is_active,
      }));
      setFinancialPhase(fetchedPhase);
      setDebts(fetchedDebts);

      const snapshotResult = await getLatestSnapshot();

      if (!profileRow || !snapshotResult || !constraintsRow) {
        setLoading(false);
        return;
      }

      const p: ProfileData = {
        visionText:    profileRow.vision_text ?? null,
        targetFreeAge: Number(profileRow.target_free_age),
        freedomType:   profileRow.freedom_type as ProfileData['freedomType'],
        monthlyTarget: Number(profileRow.freedom_number_monthly),
        portfolioTarget: Number(profileRow.portfolio_target),
        breakdown: {
          housing:           Number(profileRow.housing ?? 0),
          health_insurance:  Number(profileRow.health_insurance ?? 0),
          food:              Number(profileRow.food ?? 0),
          transportation:    Number(profileRow.transportation ?? 0),
          travel:            Number(profileRow.travel ?? 0),
          kids:              Number(profileRow.kids ?? 0),
          savings_buffer:    Number(profileRow.savings_buffer ?? 0),
          misc:              Number(profileRow.misc ?? 0),
        },
      };
      const c: ConstraintsData = {
        capitalPerYear:  Number(constraintsRow.capital_per_year),
        hoursPerWeek:    Number(constraintsRow.hours_per_week),
        riskTolerance:   constraintsRow.risk_tolerance as string,
        hardConstraints: (constraintsRow.hard_constraints as string[]) ?? [],
      };
      const prefs = (assetRows ?? []).map(r => r.asset_type as string);

      setProfile(p);
      setConstraints(c);
      setSnapshot(snapshotResult);
      setAssetPrefs(prefs);

      // Pre-fill income projections from saved assumptions, or defaults — each field
      // checks its own column for null, not just whether the row exists, since a row
      // can have some columns set and others null (e.g. seeded outside this page's own
      // handleSave, which always writes every field together). These feed the levers'
      // initial values below — defaultPlan itself (below) deliberately does NOT use
      // them, so "without adjustments" means the true no-growth baseline everywhere,
      // matching plan/results/page.tsx exactly.
      const biz12  = savedAssumptions?.business_monthly_12 != null ? Number(savedAssumptions.business_monthly_12) : snapshotResult.businessRevenue / 12;
      const biz36  = savedAssumptions?.business_monthly_36 != null ? Number(savedAssumptions.business_monthly_36) : (snapshotResult.businessRevenue / 12) * 2;
      const sp12   = savedAssumptions?.spouse_business_monthly_12 != null ? Number(savedAssumptions.spouse_business_monthly_12) : 500;
      const sp36   = savedAssumptions?.spouse_business_monthly_36 != null ? Number(savedAssumptions.spouse_business_monthly_36) : 1_500;
      const dig12  = savedAssumptions?.digital_products_monthly_12 != null ? Number(savedAssumptions.digital_products_monthly_12) : 1_000;
      const dig36  = savedAssumptions?.digital_products_monthly_36 != null ? Number(savedAssumptions.digital_products_monthly_36) : 5_000;
      const peak       = savedAssumptions?.digital_products_peak != null ? Number(savedAssumptions.digital_products_peak) : 5_000;
      const bonusPct   = savedAssumptions?.bonus_growth_rate != null ? Math.round(Number(savedAssumptions.bonus_growth_rate) * 100) : 0;

      // firstRentalDelayYears is the one saved-assumption field defaultPlan can't source
      // the same way live-recalc does: live-recalc's own fallback (defaultDelay) is
      // *derived from* defaultPlan's roadmap, so using that fallback here would be
      // circular. When nothing's saved, defaultPlan assumes no delay (0) — a real saved
      // value still applies to both sides identically.
      const savedDelay = savedAssumptions?.first_rental_delay_years != null
        ? Number(savedAssumptions.first_rental_delay_years)
        : null;

      // Compute default plan for comparison baseline — the true no-assumptions
      // baseline (current reality only), matching plan/results/page.tsx's baseline
      // exactly. Deliberately does NOT pass the user's saved income-growth
      // assumptions — otherwise "without adjustments" would mean different things on
      // different pages.
      const defaultPlanResult = generateBaselinePlan({
        freedomProfile: { visionText: p.visionText, targetFreeAge: p.targetFreeAge, freedomType: p.freedomType },
        freedomNumber: { monthlyTarget: p.monthlyTarget, portfolioTarget: p.portfolioTarget, breakdown: p.breakdown },
        snapshot: snapshotResult,
        assetPreferences: prefs,
        constraints: { capitalPerYear: c.capitalPerYear, hoursPerWeek: c.hoursPerWeek, riskTolerance: c.riskTolerance, hardConstraints: c.hardConstraints },
        financialPhase: fetchedPhase,
        debts: fetchedDebts,
      });
      setDefaultPlan(defaultPlanResult);

      // Initialize levers from DB data
      const initCapital = c.capitalPerYear;
      const initFreedom = p.monthlyTarget;
      setCapitalPerYearLever(initCapital);
      setFreedomNumberLever(initFreedom);

      // Derive default rental delay from roadmap (used only as the live lever's
      // fallback when nothing's saved — defaultPlan itself now always uses 0 delay,
      // since generateBaselinePlan passes no incomeAssumptions at all).
      const firstRentalRow = defaultPlanResult.assetRoadmap.find(
        r => r.assetType === 'long_term_rental' || r.assetType === 'short_term_rental',
      );
      const defaultDelay = firstRentalRow ? Math.max(0, firstRentalRow.year - 1) : 0;
      const delay = savedDelay ?? defaultDelay;
      setFirstRentalDelayYears(defaultDelay);

      setBizMonthly12(Math.round(biz12));
      setBizMonthly36(Math.round(biz36));
      setSpouseMonthly12(sp12);
      setSpouseMonthly36(sp36);
      setDigitalMonthly12(dig12);
      setDigitalMonthly36(dig36);
      setDigitalPeakLever(peak);
      setFirstRentalDelayYears(delay);
      setBonusGrowthPct(bonusPct);

    } catch (e) {
      console.error('loadData error:', e);
    } finally {
      setLoading(false);
    }
  }

  // ── Live recalculation ──────────────────────────────────────────────────
  const runLiveCalc = useCallback(() => {
    if (!snapshot || !profile || !constraints) return;

    // Discretionary-spend-cut lever: freed-up cash is computed via the real
    // computeMonthlyDeployable formula (reduced discretionary spend in a cloned
    // snapshot, never persisted) and added on top of capitalPerYearLever — the two
    // levers move independently and stack additively, same as every other lever pair
    // on this page.
    const reducedSnapshot: FinancialSnapshot = {
      ...snapshot,
      discretionaryMonthlySpend: Math.max(0, snapshot.discretionaryMonthlySpend - discretionaryCutLever),
      monthlySpend: snapshot.monthlySpend - Math.min(discretionaryCutLever, snapshot.discretionaryMonthlySpend),
    };
    const freedCapitalPerYear =
      (computeMonthlyDeployable(reducedSnapshot) - computeMonthlyDeployable(snapshot)) * 12;

    const inputs: PlanInputs = {
      freedomProfile: { visionText: profile.visionText, targetFreeAge: profile.targetFreeAge, freedomType: profile.freedomType },
      freedomNumber: {
        monthlyTarget:  freedomNumberLever,
        portfolioTarget: freedomNumberLever * 300,
        breakdown: profile.breakdown,
      },
      snapshot,
      assetPreferences: assetPrefs,
      constraints: {
        capitalPerYear:  capitalPerYearLever + freedCapitalPerYear,
        hoursPerWeek:    constraints.hoursPerWeek,
        riskTolerance:   constraints.riskTolerance,
        hardConstraints: constraints.hardConstraints,
      },
      financialPhase,
      debts,
    };
    const assumptions: IncomeAssumptions = {
      businessMonthly12:         bizMonthly12,
      businessMonthly36:         bizMonthly36,
      spouseBusinessMonthly12:   spouseMonthly12,
      spouseBusinessMonthly36:   spouseMonthly36,
      digitalProductsMonthly12:  digitalMonthly12,
      digitalProductsMonthly36:  digitalMonthly36,
      digitalProductsPeak:       digitalPeakLever,
      firstRentalDelayYears,
      bonusGrowthRate:           bonusGrowthPct / 100,
    };
    setLivePlan(generatePreviewPlan(inputs, assumptions));
  }, [
    snapshot, profile, constraints, assetPrefs,
    capitalPerYearLever, freedomNumberLever, digitalPeakLever, firstRentalDelayYears,
    bonusGrowthPct, discretionaryCutLever,
    bizMonthly12, bizMonthly36, spouseMonthly12, spouseMonthly36,
    digitalMonthly12, digitalMonthly36,
    financialPhase, debts,
  ]);

  useEffect(() => {
    if (!snapshot || !profile || !constraints) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runLiveCalc, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [runLiveCalc]);

  // ── Save handler ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!session || !constraints || !profile || !snapshot) return;
    setSaving(true);
    setSaveError(null);
    const sb = getBrowserSupabaseClient();
    const uid = session.user.id;

    try {
      // Save income projections
      const { error: assumptionsError } = await sb.from('plan_assumptions').upsert({
        user_id:                    uid,
        business_monthly_12:        bizMonthly12,
        business_monthly_36:        bizMonthly36,
        spouse_business_monthly_12: spouseMonthly12,
        spouse_business_monthly_36: spouseMonthly36,
        digital_products_monthly_12: digitalMonthly12,
        digital_products_monthly_36: digitalMonthly36,
        digital_products_peak:      digitalPeakLever,
        first_rental_delay_years:   firstRentalDelayYears,
        bonus_growth_rate:          bonusGrowthPct / 100,
        updated_at:                 new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (assumptionsError) {
        console.warn('plan_assumptions upsert failed:', assumptionsError.message);
      }

      // capitalPerYearLever is a local what-if preview only — capital_per_year is derived
      // read-only from the Audit deployable calculation (set by phase2/page.tsx) and must
      // not be overwritten here.

      // Update freedom_number_monthly if lever was changed
      const newFreedomNumber = freedomNumberLever !== profile.monthlyTarget ? freedomNumberLever : profile.monthlyTarget;
      if (freedomNumberLever !== profile.monthlyTarget) {
        await sb.from('freedom_profiles').update({ freedom_number_monthly: freedomNumberLever }).eq('user_id', uid);
      }

      // Regenerate + persist execution_actions synchronously here, rather than relying
      // solely on Plan Results' own regeneration-on-visit (the router.push below always
      // lands there and would redo this anyway — see plan/results/page.tsx's buildPlan).
      // Needed for correctness when the save doesn't end in a Plan Results visit that
      // actually reaches its regeneration step (e.g. a partner-view visitor never
      // triggers it there at all), and so Execute reflects the change immediately
      // instead of requiring a separate manual "Refresh actions". Uses
      // generateBaselinePlan (no incomeAssumptions) — the same true no-assumptions
      // baseline Plan Results persists — so the actions saved here are never derived
      // from a different roadmap than what generated_plans will independently end up
      // holding a moment later. Never blocks the save/redirect on failure.
      try {
        const currentYear = new Date().getFullYear();
        const [{ data: bonusPlanRow }, { data: repsRows }] = await Promise.all([
          sb.from('bonus_plan').select('frequency, plan_amount, payment_month').eq('user_id', uid).maybeSingle(),
          sb.from('material_participation_logs').select('hours_logged')
            .eq('user_id', uid)
            .gte('date', `${currentYear}-01-01`)
            .lt('date', `${currentYear + 1}-01-01`),
        ]);
        const bonusPlan: BonusPlan | null = bonusPlanRow ? {
          frequency:    bonusPlanRow.frequency as BonusPlan['frequency'],
          planAmount:   Number(bonusPlanRow.plan_amount),
          paymentMonth: bonusPlanRow.payment_month,
        } : null;
        const repsHoursThisYear = (repsRows ?? []).reduce((s, r) => s + Number(r.hours_logged ?? 0), 0);

        const inputs: PlanInputs = {
          freedomProfile: { visionText: profile.visionText, targetFreeAge: profile.targetFreeAge, freedomType: profile.freedomType },
          freedomNumber: { monthlyTarget: newFreedomNumber, portfolioTarget: profile.portfolioTarget, breakdown: profile.breakdown },
          snapshot,
          assetPreferences: assetPrefs,
          constraints: {
            capitalPerYear:  constraints.capitalPerYear,
            hoursPerWeek:    constraints.hoursPerWeek,
            riskTolerance:   constraints.riskTolerance,
            hardConstraints: constraints.hardConstraints,
          },
          financialPhase,
          debts,
        };
        const generated = generateBaselinePlan(inputs);
        const execActions = generateActions(generated, snapshot, repsHoursThisYear, bonusPlan, financialPhase);
        await saveActions(execActions, uid);
      } catch (err) {
        console.warn('Action regeneration on assumptions save failed:', err instanceof Error ? err.message : err);
      }

      router.push('/dashboard/plan/results');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed. Try again.');
      setSaving(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sign in to adjust assumptions.</p>
          <Link href="/dashboard" className="text-emerald-600 font-semibold hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const showBusiness     = snapshot && (snapshot.businessRevenue > 0 || !!snapshot.primaryBusinessType);
  const showSpouse       = snapshot && snapshot.spouseWorks === true;
  const showDigital      = assetPrefs.includes('digital_products');

  const defaultYear = defaultPlan?.freedomGap.projectedFreedomYear ?? null;
  const liveYear    = livePlan?.freedomGap.projectedFreedomYear ?? null;
  const yearDelta   = (defaultYear && liveYear) ? defaultYear - liveYear : null;

  const defaultDebtFreeYear = defaultPlan?.debtPayoff?.debtFreeYear ?? null;
  const liveDebtFreeYear    = livePlan?.debtPayoff?.debtFreeYear ?? null;
  const debtFreeYearDelta   = (defaultDebtFreeYear && liveDebtFreeYear) ? defaultDebtFreeYear - liveDebtFreeYear : null;

  const maxDiscretionaryCut = Math.max(0, Math.round(snapshot?.discretionaryMonthlySpend ?? 0));

  const rentalDelayOptions = [
    { value: 0, label: 'This year' },
    { value: 1, label: 'Next year' },
    { value: 2, label: 'In 2 years' },
    { value: 3, label: 'In 3 years' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/plan/results" className="text-sm text-gray-400 hover:text-gray-700 transition">← Plan</Link>
            <span className="text-gray-200">/</span>
            <span className="text-sm font-semibold text-gray-900">Assumptions</span>
          </div>
          <button
            onClick={() => getBrowserSupabaseClient().auth.signOut()}
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {loading && <Skeleton />}

      {!loading && (
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-12">

          {/* ── Section 1: Income Growth Projections ─────────────────────── */}
          <section className="space-y-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">Tell us where your income is going</h1>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                The plan adjusts as your businesses grow. Enter your best estimate — you can update anytime.
              </p>
            </div>

            {showBusiness && (
              <IncomeProjectionRow
                label="Your business income"
                helper="Your LLC, consulting, or side income"
                currentMonthly={Math.round((snapshot?.businessRevenue ?? 0) / 12)}
                month12={bizMonthly12}
                month36={bizMonthly36}
                onMonth12={setBizMonthly12}
                onMonth36={setBizMonthly36}
              />
            )}

            {showSpouse && (
              <IncomeProjectionRow
                label="Spouse business income"
                helper="Growing businesses start at $0 — enter what you expect"
                currentMonthly={Math.round((snapshot?.spouseBusinessRevenue ?? 0) / 12)}
                month12={spouseMonthly12}
                month36={spouseMonthly36}
                onMonth12={setSpouseMonthly12}
                onMonth36={setSpouseMonthly36}
              />
            )}

            {showDigital && (
              <IncomeProjectionRow
                label="Digital products & content income"
                helper="Your content business, courses, software — MoneyXprt included"
                currentMonthly={0}
                month12={digitalMonthly12}
                month36={digitalMonthly36}
                onMonth12={setDigitalMonthly12}
                onMonth36={setDigitalMonthly36}
              />
            )}

            {!showBusiness && !showSpouse && !showDigital && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-6 text-center">
                <p className="text-sm text-gray-500">
                  No income sources found. Complete your{' '}
                  <Link href="/dashboard/audit" className="text-emerald-600 font-semibold hover:underline">financial snapshot</Link>
                  {' '}and add{' '}
                  <Link href="/dashboard/asset-preferences" className="text-emerald-600 font-semibold hover:underline">asset preferences</Link>
                  {' '}to unlock projections.
                </p>
              </div>
            )}
          </section>

          {/* ── Section 2: Scenario Levers ───────────────────────────────── */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">What if you changed one thing?</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Move these sliders to see how your freedom date changes.
              </p>
            </div>

            {/* Lever 1 — Capital deployment */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">How much can you deploy toward assets per year?</p>
                <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1">
                  {fmt(capitalPerYearLever)}/year
                </p>
              </div>
              <input
                type="range"
                min={10_000}
                max={150_000}
                step={1_000}
                value={capitalPerYearLever}
                onChange={e => { setCapitalPerYearLever(Number(e.target.value)); touch('capital'); }}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                <span>$10K</span>
                <span>$150K</span>
              </div>
              {touched.has('capital') && (() => {
                const liveRentalYear = livePlan?.assetRoadmap.find(r => r.assetType.includes('rental'))?.calendarYear;
                const defaultRentalYear = defaultPlan?.assetRoadmap.find(r => r.assetType.includes('rental'))?.calendarYear;
                return (
                  <p className="text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-50">
                    Every $10,000 more/yr deployed accelerates your asset acquisition.
                    {liveRentalYear && defaultRentalYear && liveRentalYear < defaultRentalYear
                      ? ` At ${fmt(capitalPerYearLever)}/yr, your first rental arrives ${(defaultRentalYear - liveRentalYear) * 12} months earlier than the default pace.`
                      : liveRentalYear
                        ? ` At ${fmt(capitalPerYearLever)}/yr, your first rental is targeted for ${liveRentalYear}.`
                        : ''}
                  </p>
                );
              })()}
            </div>

            {/* Lever 2 — Freedom number */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Monthly passive income needed to be free</p>
                <p className="text-xs text-gray-400 mt-0.5">Lower this if business income covers part of your needs</p>
                <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1">
                  {fmt(freedomNumberLever)}/month
                  <span className="text-sm font-medium text-gray-400 ml-2">
                    → portfolio target: {fmtM(freedomNumberLever * 300)}
                  </span>
                </p>
              </div>
              <input
                type="range"
                min={5_000}
                max={25_000}
                step={500}
                value={freedomNumberLever}
                onChange={e => { setFreedomNumberLever(Number(e.target.value)); touch('freedom'); }}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                <span>$5K/mo</span>
                <span>$25K/mo</span>
              </div>
              {touched.has('freedom') && (
                <p className="text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-50">
                  Lowering your freedom number by $1,000/month reduces your portfolio target by $300,000 (at the 4% rule). At {fmt(freedomNumberLever)}/month, your portfolio target is {fmtM(freedomNumberLever * 300)} — significantly more achievable than a higher target.
                </p>
              )}
            </div>

            {/* Lever 3 — Digital products peak */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Peak monthly income from your content business</p>
                <p className="text-xs text-gray-400 mt-0.5">What does MoneyXprt look like at scale?</p>
                <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1">
                  {fmt(digitalPeakLever)}/month
                </p>
              </div>
              <input
                type="range"
                min={1_000}
                max={20_000}
                step={500}
                value={digitalPeakLever}
                onChange={e => { setDigitalPeakLever(Number(e.target.value)); touch('digital'); }}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                <span>$1K/mo</span>
                <span>$20K/mo</span>
              </div>
              {touched.has('digital') && (
                <p className="text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-50">
                  At {fmt(digitalPeakLever)}/month, your content business covers{' '}
                  {Math.round(Math.min(100, (digitalPeakLever / Math.max(1, freedomNumberLever)) * 100))}% of your freedom number.{' '}
                  {digitalPeakLever >= freedomNumberLever
                    ? 'At this level, digital income alone closes your freedom gap — real estate and investing accelerate the date further.'
                    : `The remaining ${fmt(Math.max(0, freedomNumberLever - digitalPeakLever))}/month gap requires less from real estate and index investing.`}
                </p>
              )}
            </div>

            {/* Lever 4 — First rental year */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">When do you plan to buy your first rental?</p>
              </div>
              <select
                value={firstRentalDelayYears}
                onChange={e => { setFirstRentalDelayYears(Number(e.target.value)); touch('rental'); }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white"
              >
                {rentalDelayOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {touched.has('rental') && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  Each year you delay the first rental pushes your passive income start date back by 12 months — and delays every subsequent acquisition that relies on cash-flow from the first property.
                </p>
              )}
            </div>

            {/* Lever 5 — Annual bonus growth rate */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">How much do you expect your bonus to grow each year?</p>
                <p className="text-xs text-gray-400 mt-0.5">Even modest bonus growth compounds significantly over time when deployed into assets</p>
                <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1">
                  {bonusGrowthPct}% per year
                </p>
                {snapshot && (snapshot.bonusTakenAsCash > 0 || bonusGrowthPct > 0) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {bonusGrowthPct === 0
                      ? `Base bonus: ${fmt(snapshot.bonusTakenAsCash)}/yr (no growth)`
                      : `Your bonus grows from ${fmt(snapshot.bonusTakenAsCash)} to ${fmt(Math.round(snapshot.bonusTakenAsCash * Math.pow(1 + bonusGrowthPct / 100, 5)))} by year 5`
                    }
                  </p>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={bonusGrowthPct}
                onChange={e => { setBonusGrowthPct(Number(e.target.value)); touch('bonus'); }}
                className="w-full accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                <span>0% (flat)</span>
                <span>20%/yr</span>
              </div>
              {touched.has('bonus') && snapshot && bonusGrowthPct > 0 && snapshot.bonusTakenAsCash > 0 && (
                <p className="text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-50">
                  A {bonusGrowthPct}% annual increase adds {fmt(Math.round(snapshot.bonusTakenAsCash * bonusGrowthPct / 100))}/yr in deployable capital in year one,
                  growing to {fmt(Math.round(snapshot.bonusTakenAsCash * (Math.pow(1 + bonusGrowthPct / 100, 5) - 1)))}/yr of additional bonus by year 5.
                  Compounded into assets over a decade, that difference is worth significantly more than the nominal amount.
                </p>
              )}
              {touched.has('bonus') && bonusGrowthPct === 0 && (
                <p className="text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-50">
                  A 5% annual bonus increase on a $100,000 bonus adds $5,000/yr this year — growing to $27,600 more in year 5. Even modest growth, deployed consistently, compounds into significant freedom-date acceleration.
                </p>
              )}
            </div>

            {/* Lever 6 — Reduce discretionary spending */}
            {maxDiscretionaryCut > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Reduce discretionary spending by</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Current discretionary spend: {fmt(snapshot?.discretionaryMonthlySpend ?? 0)}/mo
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1">
                    {fmt(discretionaryCutLever)}/month
                  </p>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxDiscretionaryCut}
                  step={50}
                  value={discretionaryCutLever}
                  onChange={e => { setDiscretionaryCutLever(Number(e.target.value)); touch('discretionary'); }}
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-medium">
                  <span>$0</span>
                  <span>{fmt(maxDiscretionaryCut)}/mo</span>
                </div>
                {touched.has('discretionary') && discretionaryCutLever > 0 && (
                  <p className="text-xs text-gray-500 leading-relaxed pt-1 border-t border-gray-50">
                    Cutting {fmt(discretionaryCutLever)}/month in discretionary spend frees up {fmt(discretionaryCutLever * 12)}/yr in deployable capital — this is a preview only and won&apos;t change your saved snapshot unless you update it directly in your financial snapshot.
                  </p>
                )}
              </div>
            )}

            {/* Live comparison card */}
            <div className={`rounded-2xl border p-5 space-y-4 transition-all ${
              livePlan ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'
            }`}>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Your Freedom Date</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Without adjustments</p>
                  <p className="text-3xl font-extrabold text-gray-300 tabular-nums leading-none">
                    {defaultYear ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">With these adjustments</p>
                  <p className="text-3xl font-extrabold text-emerald-700 tabular-nums leading-none">
                    {liveYear ?? '—'}
                  </p>
                  {yearDelta !== null && yearDelta !== 0 && (
                    <p className={`text-xs font-semibold mt-1 ${yearDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {Math.abs(yearDelta)} year{Math.abs(yearDelta) !== 1 ? 's' : ''} {yearDelta > 0 ? 'earlier' : 'later'}
                    </p>
                  )}
                  {yearDelta === 0 && liveYear && (
                    <p className="text-xs text-gray-400 mt-1">Same as default</p>
                  )}
                </div>
              </div>
              {(defaultDebtFreeYear || liveDebtFreeYear) && (
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-emerald-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Debt-free (without adjustments)</p>
                    <p className="text-xl font-extrabold text-gray-300 tabular-nums leading-none">
                      {defaultDebtFreeYear ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Debt-free (with adjustments)</p>
                    <p className="text-xl font-extrabold text-emerald-700 tabular-nums leading-none">
                      {liveDebtFreeYear ?? '—'}
                    </p>
                    {debtFreeYearDelta !== null && debtFreeYearDelta !== 0 && (
                      <p className={`text-xs font-semibold mt-1 ${debtFreeYearDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.abs(debtFreeYearDelta)} year{Math.abs(debtFreeYearDelta) !== 1 ? 's' : ''} {debtFreeYearDelta > 0 ? 'earlier' : 'later'}
                      </p>
                    )}
                    {debtFreeYearDelta === 0 && liveDebtFreeYear && (
                      <p className="text-xs text-gray-400 mt-1">Same as default</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Save button ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            {saveError && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {saving ? 'Saving…' : 'Save these assumptions → regenerate my plan'}
            </button>
            <Link
              href="/dashboard/plan/results"
              className="flex items-center justify-center w-full py-3 text-sm text-gray-400 hover:text-gray-700 transition"
            >
              Cancel — go back to plan
            </Link>
          </div>

        </main>
      )}
    </div>
  );
}

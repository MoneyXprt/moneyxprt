'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshotWithId } from '@/app/lib/snapshots';
import { evaluateAll } from '@/app/lib/strategies';
import type { FinancialSnapshot, StrategyResult } from '@/app/lib/strategies/types';
import { computeMonthlyDeployable, computeAnnualBonusNetEstimate, computeAnnualBonusNetEstimateSource, computeAnnualDeployableTotal } from '@/app/lib/deployableCapital';
import type { BonusPlan, BonusPayment } from '@/app/lib/deployableCapital';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetId =
  | 'long_term_rental'
  | 'short_term_rental'
  | 'syndication'
  | 'index_investing'
  | 'digital_products'
  | 'private_lending';

type RiskLevel = 'conservative' | 'moderate' | 'aggressive';
type ConstraintKey =
  | 'spouse_works_full_time'
  | 'cannot_manage_property'
  | 'retirement_accounts_only'
  | 'significant_debt'
  | 'not_accredited'
  | 'stay_liquid_12mo';
type DebtStrategy = 'payoff' | 'split' | 'invest';

interface AssetCardDef {
  id: AssetId;
  emoji: string;
  title: string;
  description: string;
  stats: { capital: string; time: string; income: string };
  taxNote: string;
  bestFor: string;
}

// ─── Asset definitions ────────────────────────────────────────────────────────

const ASSET_DEFS: AssetCardDef[] = [
  {
    id: 'long_term_rental',
    emoji: '🏠',
    title: 'Long Term Rental Property',
    description: 'Buy a property, place a tenant, hire a property manager. Monthly cash flow with minimal involvement once set up.',
    stats: { capital: '$60K–$100K down', time: 'Low with PM', income: '$500–$2,000/mo per property' },
    taxNote: 'Pairs with REPS for significant W-2 tax offset via depreciation',
    bestFor: 'High earners with capital who want passive income and tax reduction',
  },
  {
    id: 'short_term_rental',
    emoji: '🏖️',
    title: 'Short Term Rental (Airbnb/VRBO)',
    description: 'Higher income potential than long term but requires more active management or a co-host.',
    stats: { capital: '$60K–$120K down', time: 'Medium', income: '$1,500–$4,000/mo per property' },
    taxNote: 'Average rental period under 7 days qualifies for different passive activity rules',
    bestFor: 'High earners in tourist markets willing to be more hands-on',
  },
  {
    id: 'syndication',
    emoji: '🏢',
    title: 'Real Estate Syndication',
    description: 'Invest passively in large commercial or multifamily deals alongside other investors. You provide capital, a sponsor manages everything.',
    stats: { capital: '$50K–$100K min', time: 'Zero', income: '$500–$1,500/mo per investment' },
    taxNote: 'Passive losses may offset passive income — consult your CPA on structure',
    bestFor: 'High earners who want real estate exposure without being a landlord',
  },
  {
    id: 'index_investing',
    emoji: '📈',
    title: 'Index Fund Portfolio',
    description: 'Consistent long term wealth building through low-cost diversified index funds. The slow but certain engine.',
    stats: { capital: 'Any amount', time: 'Zero', income: '$1,000–$3,000/mo at $300K–$900K invested' },
    taxNote: 'Tax-advantaged accounts (401k, Roth, backdoor Roth) reduce drag significantly',
    bestFor: 'Everyone — this should run alongside every other engine',
  },
  {
    id: 'digital_products',
    emoji: '💻',
    title: 'Digital Products or Content Business',
    description: 'Build income through expertise — courses, newsletters, software, consulting. High upside, requires time to build.',
    stats: { capital: 'Low', time: 'High initially, lower at scale', income: '$2,000–$20,000+/mo' },
    taxNote: 'Business structure (LLC, S-Corp at scale) unlocks additional tax strategies',
    bestFor: 'High earners with transferable expertise willing to invest time building',
  },
  {
    id: 'private_lending',
    emoji: '📋',
    title: 'Private Lending / Mortgage Notes',
    description: 'Lend money secured by real estate. Collect interest payments without owning or managing property.',
    stats: { capital: '$25K–$100K', time: 'Low', income: '$200–$800/mo per note' },
    taxNote: 'Interest income is ordinary income — less tax-efficient than equity-based assets',
    bestFor: 'High earners who want real estate exposure with no landlord responsibilities',
  },
];

const RISK_OPTIONS: { value: RiskLevel; title: string; description: string }[] = [
  { value: 'conservative', title: 'Conservative', description: "I prioritize protecting what I have. Slower growth is fine if it's stable." },
  { value: 'moderate',     title: 'Moderate',     description: 'I can handle some volatility for better long-term returns.' },
  { value: 'aggressive',   title: 'Aggressive',   description: "I'm focused on maximum growth. I can stomach significant swings." },
];

const HARD_CONSTRAINTS: { key: ConstraintKey; label: string; subtext: string }[] = [
  { key: 'spouse_works_full_time',    label: 'My spouse works full time',                         subtext: 'Affects REPS eligibility for rental depreciation offset' },
  { key: 'cannot_manage_property',    label: "I can't manage property actively",                   subtext: 'Filters out short-term rental recommendations' },
  { key: 'retirement_accounts_only',  label: "I'm not able to invest outside retirement accounts", subtext: 'Limits plan to 401k, IRA, and HSA strategies' },
  { key: 'significant_debt',          label: 'I have significant debt to address first',           subtext: 'Plan will sequence debt paydown before asset acquisition' },
  { key: 'not_accredited',            label: "I'm not accredited",                                subtext: 'Limits syndication access — generally $200K+ income or $1M+ net worth' },
  { key: 'stay_liquid_12mo',          label: 'I want to stay fully liquid for the next 12 months', subtext: 'Removes illiquid asset classes from near-term recommendations' },
];

const TIMEFRAME_OPTIONS = ['This year', 'Next year', '2-3 years', 'Just exploring'] as const;

// ─── Styles ───────────────────────────────────────────────────────────────────

const SLIDER_CSS = `
  .p2-slider { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; outline: none; cursor: pointer; width: 100%; }
  .p2-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; border-radius: 50%; background: #059669; border: 3px solid white; box-shadow: 0 2px 8px rgba(5,150,105,0.35); cursor: pointer; }
  .p2-slider::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; background: #059669; border: 3px solid white; box-shadow: 0 2px 8px rgba(5,150,105,0.35); cursor: pointer; }
`;

function sliderGrad(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, #059669 0%, #059669 ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function fmt(n: number) { return `$${Math.round(n).toLocaleString('en-US')}`; }

function getHighRateDebts(s: FinancialSnapshot) {
  return [
    { label: 'Car loan',       balance: s.carLoanBalance,      rate: s.carLoanRate },
    { label: 'Personal loan',  balance: s.personalLoanBalance, rate: s.personalLoanRate },
    { label: 'Credit card',    balance: s.creditCardBalance,   rate: s.creditCardRate },
    { label: 'Student loan',   balance: s.studentLoanBalance,  rate: s.studentLoanRate },
    { label: 'Business loan',  balance: s.businessLoanBalance, rate: s.businessLoanRate },
    { label: s.otherDebtLabel || 'Other debt', balance: s.otherDebtBalance, rate: s.otherDebtRate },
  ].filter(d => d.balance > 0 && d.rate > 0.06);
}

function assetFitReason(id: AssetId, s: FinancialSnapshot): string {
  switch (id) {
    case 'long_term_rental':
      if (!s.spouseWorks) return 'Pairs well with REPS — your spouse may qualify since they\'re not currently employed';
      if (s.spouseHoursPerWeekInBusiness <= 20) return 'Pairs well with REPS since your spouse has limited work hours available';
      return 'Tax advantage through depreciation; REPS requires 750+ hrs/yr in real estate activities';
    case 'short_term_rental':
      return 'Higher income than long term but requires more active involvement or a co-host';
    case 'syndication': {
      const totalIncome = s.w2Income + s.spouseW2Income + s.income1099 + s.businessRevenue;
      return totalIncome >= 200_000
        ? 'You likely qualify as an accredited investor based on your income level'
        : 'Requires accredited investor status — generally $200K+ income or $1M+ net worth';
    }
    case 'index_investing':
      return 'Works alongside any other engine you choose — most people select this plus one more';
    case 'digital_products':
      if (s.businessRevenue > 0) return 'You already have a business generating revenue — this builds on what\'s working';
      return 'Lowest capital requirement — build income through expertise, content, or software';
    case 'private_lending':
      return s.taxableBrokerageBalance > 50_000
        ? 'You have liquid capital that could generate 9–12% returns via secured notes'
        : 'Lend secured by real estate — interest income without managing a property';
  }
}

function assetPriority(id: AssetId, s: FinancialSnapshot): number {
  switch (id) {
    case 'long_term_rental':
      return (!s.spouseWorks || s.spouseHoursPerWeekInBusiness <= 20) ? 3 : 1;
    case 'index_investing':
      return 2;
    case 'digital_products':
      return s.businessRevenue > 0 ? 4 : 0;
    default:
      return 0;
  }
}

function orderedAssets(s: FinancialSnapshot) {
  return [...ASSET_DEFS].sort((a, b) => assetPriority(b.id, s) - assetPriority(a.id, s));
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i + 1 < current ? 'w-5 h-1.5 bg-emerald-500' :
            i + 1 === current ? 'w-6 h-1.5 bg-emerald-400' :
            'w-3 h-1.5 bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.12em] leading-none mb-1">
      {text}
    </p>
  );
}

function ContinueBtn({ onClick, label = 'Continue →', disabled }: {
  onClick: () => void; label?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-4 rounded-2xl bg-[#1B3A2D] text-white font-bold text-base hover:bg-[#152d22] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition"
    >
      {label}
    </button>
  );
}

function CheckIcon({ on }: { on: boolean; }) {
  return (
    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 ${
      on ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'
    }`}>
      {on && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

function RadioDot({ on }: { on: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
      on ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 bg-white'
    }`}>
      {on && <div className="w-2 h-2 rounded-full bg-white" />}
    </div>
  );
}

function IncomeRow({ label, helper, currentMonthly, m12, m36, onM12, onM36 }: {
  label: string;
  helper: string;
  currentMonthly: number;
  m12: number;
  m36: number;
  onM12: (v: number) => void;
  onM36: (v: number) => void;
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
          <div className="relative mt-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>
            <input
              type="number" min="0" value={m12 || ''} placeholder="0"
              onChange={e => onM12(Number(e.target.value) || 0)}
              className="w-full pl-5 pr-2 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white"
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">In 36 mo</p>
          <div className="relative mt-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">$</span>
            <input
              type="number" min="0" value={m36 || ''} placeholder="0"
              onChange={e => onM36(Number(e.target.value) || 0)}
              className="w-full pl-5 pr-2 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
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
      options: { emailRedirectTo: `${window.location.origin}/dashboard/plan/phase2` },
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
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Almost there.</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to set your direction.</p>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Phase2Page() {
  const router      = useRouter();
  const params      = useSearchParams();
  const isFresh     = params.get('fresh') === 'true';

  const [session, setSession]         = useState<Session | null>(null);
  const [sessionLoading, setSessLoad] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  // Loaded context
  const [snapshot, setSnapshot]         = useState<FinancialSnapshot | null>(null);
  const [snapshotId, setSnapshotId]     = useState<string | null>(null);
  const [activeStrategies, setActiveStrategies] = useState<StrategyResult[]>([]);
  const [bonusPlan, setBonusPlan]         = useState<BonusPlan | null>(null);
  const [bonusPayments, setBonusPayments] = useState<BonusPayment[]>([]);

  // Section 1 — Stability
  const [stabilizationMonthly, setStabilizationMonthly] = useState(0);
  const [debtStrategy, setDebtStrategy]                 = useState<DebtStrategy | null>(null);

  // Section 2 — Tax commitment
  const [excludedStrategyIds, setExcludedStrategyIds] = useState<Set<string>>(new Set());

  // Section 3 — Asset direction
  const [assetSelections, setAssetSelections] = useState<Set<AssetId>>(new Set());
  const [acquisitionTimeframe, setAcquisitionTimeframe] = useState('');

  // Section 4 — Constraints
  const [hoursPerWeek,   setHoursPerWeek]   = useState(5);
  const [riskTolerance,  setRiskTolerance]  = useState<RiskLevel>('moderate');
  const [hardConstraints, setHardConstraints] = useState<Set<ConstraintKey>>(new Set());
  const [constraintsPreloaded, setConstraintsPreloaded] = useState(false);

  // Section 5 — Projections
  const [bizMonthly12,     setBizMonthly12]     = useState(0);
  const [bizMonthly36,     setBizMonthly36]     = useState(0);
  const [spouseMonthly12,  setSpouseMonthly12]  = useState(0);
  const [spouseMonthly36,  setSpouseMonthly36]  = useState(0);
  const [digitalMonthly12, setDigitalMonthly12] = useState(1_000);
  const [digitalMonthly36, setDigitalMonthly36] = useState(5_000);

  // Navigation
  const [step, setStep] = useState(1);  // 1–5

  // ── Derived state ─────────────────────────────────────────────────────────

  const highRateDebts = snapshot ? getHighRateDebts(snapshot) : [];
  const lowEmergencyFund = snapshot
    ? snapshot.emergencyFund < snapshot.monthlySpend * 3 && snapshot.monthlySpend > 0
    : false;
  const needsSection1 = lowEmergencyFund || highRateDebts.length > 0;

  const showSection5 = snapshot
    ? (snapshot.businessRevenue > 0 || !!snapshot.primaryBusinessType || snapshot.spouseWorks || assetSelections.has('digital_products'))
    : false;

  const totalHighRateDebt  = highRateDebts.reduce((s, d) => s + d.balance, 0);
  const highestRate        = highRateDebts.length > 0 ? Math.max(...highRateDebts.map(d => d.rate)) : 0;
  const emergencyMonths    = snapshot
    ? (snapshot.monthlySpend > 0 ? snapshot.emergencyFund / snapshot.monthlySpend : 0)
    : 0;
  const selectedRentalType = assetSelections.has('long_term_rental') || assetSelections.has('short_term_rental');

  // Deployable capital is no longer user-editable — derived directly from the corrected
  // Audit deployable calculation (src/app/lib/deployableCapital.ts).
  // "Per month" is recurring-only (no bonus); capitalPerYear (fed to the plan generator)
  // is the full "Total this year" figure — recurring annualized + bonus net estimate —
  // since that's the true annual investable-capital estimate for anyone with a bonus plan.
  const monthlyDeployable = snapshot ? computeMonthlyDeployable(snapshot) : 0;
  const bonusNetEstimate       = computeAnnualBonusNetEstimate(bonusPlan, bonusPayments);
  const bonusNetEstimateSource = computeAnnualBonusNetEstimateSource(bonusPlan, bonusPayments);
  const capitalPerYear    = snapshot ? Math.round(computeAnnualDeployableTotal(snapshot, bonusPlan, bonusPayments)) : 0;

  // ── Data load ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async (s: Session) => {
    setDataLoading(true);
    try {
      const sb  = getBrowserSupabaseClient();
      const uid = s.user.id;

      const [snapResult, { data: assetRows }, { data: constraintsRow }, { data: assumptionsRow }, { data: bonusPlanRow }, { data: bonusPaymentRows }] =
        await Promise.all([
          getLatestSnapshotWithId(),
          sb.from('asset_preferences').select('asset_type').eq('user_id', uid).eq('selected', true),
          sb.from('user_constraints').select('hours_per_week,risk_tolerance,hard_constraints').eq('user_id', uid).maybeSingle(),
          sb.from('plan_assumptions').select('*').eq('user_id', uid).maybeSingle(),
          sb.from('bonus_plan').select('frequency, plan_amount, payment_month').eq('user_id', uid).maybeSingle(),
          sb.from('bonus_payments_actual').select('amount, net_amount, date_paid').eq('user_id', uid),
        ]);

      setBonusPlan(bonusPlanRow ? {
        frequency:    bonusPlanRow.frequency as BonusPlan['frequency'],
        planAmount:   Number(bonusPlanRow.plan_amount),
        paymentMonth: bonusPlanRow.payment_month,
      } : null);
      setBonusPayments((bonusPaymentRows ?? []).map(r => ({
        amount:    Number(r.amount),
        datePaid:  new Date(r.date_paid),
        netAmount: r.net_amount != null ? Number(r.net_amount) : undefined,
      })));

      if (snapResult) {
        setSnapshot(snapResult.snapshot);
        setSnapshotId(snapResult.id);
        const actives = evaluateAll(snapResult.snapshot)
          .filter(r => r.state === 'ACTIVE' && (r.estimatedAnnualValue ?? 0) > 0);
        setActiveStrategies(actives);

        // Pre-exclude any previously excluded strategy ids
        const preExcluded = snapResult.snapshot.excludedStrategyIds ?? [];
        if (preExcluded.length > 0 && !isFresh) {
          setExcludedStrategyIds(new Set(preExcluded));
        }
      }

      if (!isFresh) {
        // Pre-populate Section 3
        if (assetRows?.length) {
          setAssetSelections(new Set(assetRows.map(r => r.asset_type as AssetId)));
        }
        if (snapResult?.snapshot.targetAcquisitionTimeframe) {
          setAcquisitionTimeframe(snapResult.snapshot.targetAcquisitionTimeframe);
        }

        // Pre-populate Section 4
        if (constraintsRow) {
          setHoursPerWeek(Number(constraintsRow.hours_per_week) || 5);
          setRiskTolerance((constraintsRow.risk_tolerance as RiskLevel) || 'moderate');
          if (Array.isArray(constraintsRow.hard_constraints)) {
            setHardConstraints(new Set(constraintsRow.hard_constraints as ConstraintKey[]));
          }
          setConstraintsPreloaded(true);
        }

        // Pre-populate Section 5
        if (assumptionsRow) {
          setBizMonthly12(Number(assumptionsRow.business_monthly_12) || 0);
          setBizMonthly36(Number(assumptionsRow.business_monthly_36) || 0);
          setSpouseMonthly12(Number(assumptionsRow.spouse_business_monthly_12) || 0);
          setSpouseMonthly36(Number(assumptionsRow.spouse_business_monthly_36) || 0);
          setDigitalMonthly12(Number(assumptionsRow.digital_products_monthly_12) || 1_000);
          setDigitalMonthly36(Number(assumptionsRow.digital_products_monthly_36) || 5_000);
        }
      }
    } finally {
      setDataLoading(false);
    }
  }, [isFresh]);

  // ── Session + pre-populate constraints from Phase 1 if no DB data ─────────

  useEffect(() => {
    if (!snapshot || constraintsPreloaded || isFresh) return;
    // Infer logical constraints from Phase 1 data
    const implied = new Set<ConstraintKey>(hardConstraints);
    if (snapshot.spouseWorks && snapshot.spouseHoursPerWeekInBusiness > 20) {
      implied.add('spouse_works_full_time');
    }
    if (snapshot.taxableBrokerageBalance === 0 && snapshot.emergencyFund < snapshot.monthlySpend * 3) {
      implied.add('stay_liquid_12mo');
    }
    if (implied.size !== hardConstraints.size) {
      setHardConstraints(implied);
    }
  }, [snapshot, constraintsPreloaded, isFresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessLoad(false);
      if (s) loadData(s);
      else setDataLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s && !snapshot) loadData(s);
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-skip Section 1 if not needed after data loads
  useEffect(() => {
    if (!dataLoading && snapshot && !needsSection1 && step === 1) {
      setStep(2);
    }
  }, [dataLoading, snapshot, needsSection1]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ────────────────────────────────────────────────────────────

  const advance = () => {
    setStep(prev => {
      // Step 1 → 2 always
      // Step 4 → 5 only if section 5 is needed; otherwise trigger submit
      if (prev === 4 && !showSection5) {
        // handled separately by CTA button logic
        return prev;
      }
      return prev + 1;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    setStep(prev => {
      const next = prev - 1;
      // Skip step 1 backwards if it wasn't shown
      if (next === 1 && !needsSection1) return 2;
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Rental timeframe select — immediate save ──────────────────────────────
  // Targets the latest snapshot row by its specific id (fetched fresh at call time,
  // not stale React state). If data: [] returns with error: null it means the UPDATE
  // RLS policy is missing — surfaces an error and names the SQL fix needed.

  const handleTimeframeSelect = async (opt: string) => {
    setAcquisitionTimeframe(opt);

    const sb = getBrowserSupabaseClient();
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) {
      console.warn('[phase2-section3] no auth user — cannot save');
      return;
    }

    // Fetch the latest snapshot id fresh — don't depend on potentially-null React state.
    const { data: latestRow, error: fetchErr } = await sb
      .from('financial_snapshots')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('[phase2-section3] latest snapshot row:', { id: latestRow?.id, fetchErr: fetchErr?.message ?? null });

    if (fetchErr || !latestRow?.id) {
      setSaveError('Could not find your snapshot to update — please refresh and try again.');
      return;
    }

    const payload = { considering_real_estate: true };
    console.log('[phase2-section3] about to save considering_real_estate:', {
      ...payload,
      target_acquisition_timeframe: opt,
      snapshot_id: latestRow.id,
      user_id: user.id,
    });

    const { data, error } = await sb
      .from('financial_snapshots')
      .update(payload)
      .eq('id', latestRow.id)
      .select();

    console.log('[phase2-section3] save result:', { data, error: error?.message ?? null });

    if (error) {
      setSaveError(`Could not save real estate preference: ${error.message}`);
    } else if (!data || data.length === 0) {
      // data: [] with error: null is PostgREST's silent RLS block —
      // the UPDATE policy is missing on financial_snapshots.
      // SQL fix (run in Supabase SQL editor):
      //   create policy "Users can update their own snapshots"
      //   on public.financial_snapshots for update
      //   using (auth.uid() = user_id) with check (auth.uid() = user_id);
      console.error(
        '[phase2-section3] UPDATE returned 0 rows — missing UPDATE RLS policy on financial_snapshots.\n' +
        'Run in Supabase SQL editor:\n' +
        "  create policy \"Users can update their own snapshots\"\n" +
        '  on public.financial_snapshots for update\n' +
        '  using (auth.uid() = user_id) with check (auth.uid() = user_id);'
      );
      setSaveError(
        'DB permission missing — run the UPDATE policy migration in Supabase SQL editor (see browser console for the exact SQL).'
      );
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!session) return;
    setSaving(true);
    setSaveError(null);
    try {
      const sb  = getBrowserSupabaseClient();
      const { data: { user }, error: authErr } = await sb.auth.getUser();
      if (authErr || !user) throw new Error('Session expired — please sign in again.');
      const uid = user.id;

      const selectedArray = Array.from(assetSelections);

      // 1. Asset preferences
      await sb.from('asset_preferences').delete().eq('user_id', uid);
      if (selectedArray.length > 0) {
        const { error: insertErr } = await sb.from('asset_preferences').insert(
          selectedArray.map(asset_type => ({ user_id: uid, asset_type, selected: true }))
        );
        if (insertErr) throw insertErr;
      }

      // 2. User constraints
      const { error: constraintsErr } = await sb.from('user_constraints').upsert({
        user_id:          uid,
        capital_per_year: capitalPerYear,
        hours_per_week:   hoursPerWeek,
        risk_tolerance:   riskTolerance,
        hard_constraints: Array.from(hardConstraints),
      }, { onConflict: 'user_id' });
      if (constraintsErr) throw constraintsErr;

      // 3. Plan assumptions
      const { error: assumptionsErr } = await sb.from('plan_assumptions').upsert({
        user_id:                      uid,
        business_monthly_12:          bizMonthly12,
        business_monthly_36:          bizMonthly36,
        spouse_business_monthly_12:   spouseMonthly12,
        spouse_business_monthly_36:   spouseMonthly36,
        digital_products_monthly_12:  digitalMonthly12,
        digital_products_monthly_36:  digitalMonthly36,
        stabilization_monthly_amount: stabilizationMonthly,
        debt_strategy:                debtStrategy ?? '',
        updated_at:                   new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (assumptionsErr) console.warn('plan_assumptions upsert:', assumptionsErr.message);

      // 4a. Update considering_real_estate — fetch the latest snapshot id fresh at submit time.
      // Targeting by specific id (not user_id alone) so the filter is unambiguous.
      const consideringRE = assetSelections.has('long_term_rental') || assetSelections.has('short_term_rental');

      const { data: latestSnapRow } = await sb
        .from('financial_snapshots')
        .select('id')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('[phase2-submit] about to save considering_real_estate:', {
        considering_real_estate: consideringRE,
        snapshot_id: latestSnapRow?.id ?? null,
        user_id: uid,
      });

      if (latestSnapRow?.id) {
        const { data: updData, error: coreUpdErr } = await sb
          .from('financial_snapshots')
          .update({ considering_real_estate: consideringRE })
          .eq('id', latestSnapRow.id)
          .select();
        console.log('[phase2-submit] save result:', { data: updData, error: coreUpdErr?.message ?? null });
        if (coreUpdErr) throw new Error(`Failed to save real estate preference: ${coreUpdErr.message}`);
        if (!updData || updData.length === 0) {
          // data: [] with no error = RLS is blocking the UPDATE.
          // See console for the required policy SQL, or check the error surfaced to the user.
          throw new Error(
            'DB permission missing — add an UPDATE policy on financial_snapshots. ' +
            'SQL: create policy "Users can update their own snapshots" on public.financial_snapshots ' +
            'for update using (auth.uid() = user_id) with check (auth.uid() = user_id);'
          );
        }
      } else {
        console.warn('[phase2-submit] no snapshot row found — skipping considering_real_estate update');
      }

      // 4b. Update newer columns added in Phase 2 migration — warn but don't throw if not yet migrated.
      const { error: newColsErr } = await sb.from('financial_snapshots').update({
        excluded_strategy_ids:        JSON.stringify(Array.from(excludedStrategyIds)),
        target_acquisition_timeframe: acquisitionTimeframe || null,
      }).eq('user_id', uid);
      if (newColsErr) console.warn('[phase2-submit] new-column update (run migrations if this fires):', newColsErr.message);

      router.push('/dashboard/plan/results');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  // ── Render guards ──────────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <style>{SLIDER_CSS}</style>
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <div>
              <SectionLabel text="Phase 2 of 2 — Where You're Going" />
              <p className="text-xs text-gray-400">Build Your Plan</p>
            </div>
            <ProgressDots total={5} current={1} />
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading your snapshot…</p>
        </div>
      </div>
    );
  }

  // ── Section content ────────────────────────────────────────────────────────

  const s = snapshot;

  // Section 1 — Stability Check
  function renderSection1() {
    if (!s) return null;
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Let's stabilize first.</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            A couple of things from your snapshot deserve attention before we build the asset roadmap.
          </p>
        </div>

        {/* Emergency fund */}
        {lowEmergencyFund && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Your emergency fund covers {emergencyMonths.toFixed(1)} months.</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  We recommend 6 months ({fmt(s.monthlySpend * 6)}) as a foundation before aggressive investing.
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                How much can you redirect toward building it each month?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  value={stabilizationMonthly || ''}
                  placeholder="500"
                  onChange={e => setStabilizationMonthly(Number(e.target.value) || 0)}
                  className="w-full pl-6 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
              {stabilizationMonthly > 0 && (
                <p className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 leading-relaxed">
                  At {fmt(stabilizationMonthly)}/mo, you reach 6 months of reserves in{' '}
                  {Math.ceil((s.monthlySpend * 6 - s.emergencyFund) / stabilizationMonthly)} months. This becomes Phase 1 of your plan.
                </p>
              )}
            </div>
          </div>
        )}

        {/* High-rate debt */}
        {highRateDebts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-4.5 h-4.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">You have debt working against you.</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {fmt(totalHighRateDebt)} in debt above 6% interest. Paying this off is a guaranteed{' '}
                  {(highestRate * 100).toFixed(0)}% return — often better than investing.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {(
                [
                  { key: 'payoff' as DebtStrategy, label: 'Pay off high-rate debt before investing in assets', tagline: `Guaranteed ${(highestRate * 100).toFixed(0)}% return. Roadmap starts later but capital is unencumbered.` },
                  { key: 'split'  as DebtStrategy, label: 'Split — half toward debt, half toward assets',     tagline: 'Balanced approach. Debt shrinks and assets grow simultaneously.' },
                  { key: 'invest' as DebtStrategy, label: 'Invest alongside debt — I\'ll manage both',        tagline: 'Highest velocity, highest pressure. Works best with stable income.' },
                ] as { key: DebtStrategy; label: string; tagline: string }[]
              ).map(opt => {
                const on = debtStrategy === opt.key;
                // Quick math: payoff months at half of stabilization or $1k/mo
                const payoffMonths = stabilizationMonthly > 0
                  ? Math.ceil(totalHighRateDebt / (opt.key === 'split' ? stabilizationMonthly / 2 : stabilizationMonthly))
                  : null;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDebtStrategy(opt.key)}
                    className={`w-full text-left rounded-xl border-2 px-4 py-3.5 flex items-start gap-3 transition-all active:scale-[0.99] ${
                      on ? 'border-emerald-500 bg-emerald-50/60' : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <RadioDot on={on} />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium leading-tight ${on ? 'text-emerald-900' : 'text-gray-800'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.tagline}</p>
                      {on && payoffMonths !== null && opt.key !== 'invest' && (
                        <p className="mt-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">
                          At your current monthly amount, debt is cleared in ~{payoffMonths} months — then the full {fmt(stabilizationMonthly || 1000)}/mo goes toward assets.
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ContinueBtn onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </div>
    );
  }

  // Section 2 — Tax Strategy Commitment
  function renderSection2() {
    const toggle = (id: string) => {
      setExcludedStrategyIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Which of these will you actually implement this year?
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Be honest — your plan is built on what you&apos;ll commit to, not just what&apos;s possible.
          </p>
        </div>

        {activeStrategies.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-sm text-gray-500">No active strategies found based on your snapshot.</p>
            <p className="text-xs text-gray-400 mt-1">Update your financial snapshot to unlock strategies.</p>
          </div>
        )}

        <div className="space-y-3">
          {activeStrategies.map(strat => {
            const included = !excludedStrategyIds.has(strat.id);
            return (
              <button
                key={strat.id}
                type="button"
                onClick={() => toggle(strat.id)}
                className={`w-full text-left rounded-2xl border-2 p-4 flex items-start gap-4 transition-all active:scale-[0.99] ${
                  included
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-gray-100 bg-white opacity-60 hover:opacity-80'
                }`}
              >
                <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  included ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                }`}>
                  {included && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-semibold leading-tight ${included ? 'text-emerald-900' : 'text-gray-500'}`}>
                      {strat.name}
                    </p>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${included ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {fmt(strat.estimatedAnnualValue ?? 0)}/yr
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                    {strat.reason.slice(0, 120)}{strat.reason.length > 120 ? '…' : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {activeStrategies.length > 0 && (
          <p className="text-xs text-gray-400 text-center leading-relaxed px-2">
            Strategies you toggle off won&apos;t count toward your deployable capital.
            You can always add them back later.
          </p>
        )}

        <ContinueBtn onClick={() => advance()} disabled={activeStrategies.length > 0 && activeStrategies.every(s => excludedStrategyIds.has(s.id))} />
      </div>
    );
  }

  // Section 3 — Asset Direction
  function renderSection3() {
    if (!s) return null;
    const ordered = orderedAssets(s);
    const toggle = (id: AssetId) => {
      setAssetSelections(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Based on your situation, here&apos;s what makes sense to consider.
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            These aren&apos;t recommendations — they&apos;re options sized to what you have.
            You decide.
          </p>
        </div>

        <div className="space-y-4">
          {ordered.map(card => {
            const selected = assetSelections.has(card.id);
            const fitLine  = assetFitReason(card.id, s);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => toggle(card.id)}
                className={`w-full text-left rounded-2xl border-2 p-5 transition-all duration-150 active:scale-[0.99] ${
                  selected ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                {/* Fit line */}
                {fitLine && (
                  <p className="text-[11px] italic text-emerald-700 leading-snug mb-3 pl-0.5">
                    {fitLine}
                  </p>
                )}

                {/* Top row */}
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl leading-none shrink-0 mt-0.5">{card.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-base font-bold leading-tight ${selected ? 'text-emerald-900' : 'text-gray-900'}`}>
                      {card.title}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-200'
                  }`}>
                    {selected && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-4">{card.description}</p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-y border-gray-100 text-left">
                  {[
                    { label: 'Capital', value: card.stats.capital },
                    { label: 'Time',    value: card.stats.time },
                    { label: 'Income',  value: card.stats.income },
                  ].map(stat => (
                    <div key={stat.label}>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{stat.label}</p>
                      <p className="text-xs text-gray-700 leading-tight">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Tax note */}
                <p className="text-xs text-indigo-700 leading-relaxed">{card.taxNote}</p>
              </button>
            );
          })}
        </div>

        {/* Rental timing follow-up */}
        {selectedRentalType && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">When are you thinking about this?</p>
            <div className="grid grid-cols-2 gap-2">
              {TIMEFRAME_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleTimeframeSelect(opt)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium text-center transition-colors ${
                    acquisitionTimeframe === opt
                      ? 'bg-amber-200 text-amber-900 border border-amber-300'
                      : 'bg-white border border-amber-100 text-amber-700 hover:border-amber-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center leading-relaxed px-4">
          You&apos;re not committing to anything. This tells us what to include in your plan.
        </p>

        <ContinueBtn
          onClick={() => advance()}
          disabled={assetSelections.size === 0}
          label="Continue →"
        />
      </div>
    );
  }

  // Section 4 — Timeline and Constraints
  function renderSection4() {
    const toggleConstraint = (key: ConstraintKey) => {
      setHardConstraints(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    };

    const isLastStep = !showSection5;

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Timeline &amp; constraints.
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Tell us what you&apos;re working with and we&apos;ll build around it.
          </p>
        </div>

        {/* Deployable capital — derived from Audit deployable calculation, read-only.
            "Per month" is recurring only (no bonus); "Total this year" adds the bonus
            net estimate/actual as its own line, never smoothed into the monthly figure. */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">How much can you deploy toward assets?</p>
            <p className="text-xs text-gray-400 mt-0.5">Calculated from your Financial Snapshot: take-home pay minus expenses and debt payments.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Per month</p>
              <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1 leading-none">
                {fmt(monthlyDeployable)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">recurring — no bonus</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Total this year</p>
              <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-1 leading-none">
                {fmt(capitalPerYear)}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {bonusPlan
                  ? `incl. ${fmt(bonusNetEstimate)} bonus (${bonusNetEstimateSource === 'actual' ? 'actual, net' : 'est., net of withholding'})`
                  : 'recurring × 12'}
              </p>
            </div>
          </div>
        </div>

        {/* Hours per week */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Hours per week available for building?</p>
            <p className="text-xs text-gray-400 mt-0.5">Active management, research, networking — not passive time.</p>
            <p className="text-3xl font-extrabold text-emerald-700 tabular-nums mt-2 leading-none">
              {hoursPerWeek}<span className="text-base font-medium text-gray-400 ml-2">hrs / week</span>
            </p>
          </div>
          <input
            type="range" min={0} max={20} step={1} value={hoursPerWeek}
            onChange={e => setHoursPerWeek(Number(e.target.value))}
            className="p2-slider"
            style={{ background: sliderGrad(hoursPerWeek, 0, 20) }}
          />
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>0 (fully passive)</span><span>10 hrs</span><span>20+ hrs</span>
          </div>
        </div>

        {/* Risk tolerance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-900">How do you handle investment risk?</p>
          <div className="flex flex-col gap-2.5">
            {RISK_OPTIONS.map(opt => {
              const on = riskTolerance === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => setRiskTolerance(opt.value)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3.5 flex items-start gap-3 transition-all active:scale-[0.99] ${
                    on ? 'border-emerald-500 bg-emerald-50/60' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <RadioDot on={on} />
                  <div>
                    <p className={`text-sm font-semibold leading-tight ${on ? 'text-emerald-900' : 'text-gray-900'}`}>{opt.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hard constraints */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Anything that limits your options?</p>
            <p className="text-xs text-gray-400 mt-0.5">Check everything that applies — your plan won&apos;t recommend what won&apos;t work.</p>
          </div>
          <div className="flex flex-col gap-2">
            {HARD_CONSTRAINTS.map(item => {
              const checked = hardConstraints.has(item.key);
              return (
                <button key={item.key} type="button" onClick={() => toggleConstraint(item.key)}
                  className={`w-full text-left rounded-xl border-2 px-4 py-3.5 flex items-start gap-3 transition-all active:scale-[0.99] ${
                    checked ? 'border-emerald-500 bg-emerald-50/40' : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <CheckIcon on={checked} />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-tight ${checked ? 'text-emerald-900' : 'text-gray-800'}`}>{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.subtext}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {isLastStep ? (
          <>
            {saveError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700">{saveError}</div>
            )}
            <button
              onClick={handleSubmit}
              disabled={saving || assetSelections.size === 0}
              className="w-full py-4 rounded-2xl bg-[#1B3A2D] text-white font-bold text-base hover:bg-[#152d22] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              {saving
                ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                : 'Build my freedom plan →'
              }
            </button>
          </>
        ) : (
          <ContinueBtn onClick={() => advance()} />
        )}
      </div>
    );
  }

  // Section 5 — Growth Projections
  function renderSection5() {
    if (!s) return null;
    const showBusiness = s.businessRevenue > 0 || !!s.primaryBusinessType;
    const showSpouse   = s.spouseWorks;
    const showDigital  = assetSelections.has('digital_products');

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">Where is your income going?</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Your plan adjusts as your income grows. Enter your best estimate — you can update anytime.
          </p>
        </div>

        {showBusiness && (
          <IncomeRow
            label="Your business income"
            helper="Your LLC, consulting, or side income"
            currentMonthly={Math.round(s.businessRevenue / 12)}
            m12={bizMonthly12} m36={bizMonthly36}
            onM12={setBizMonthly12} onM36={setBizMonthly36}
          />
        )}
        {showSpouse && (
          <IncomeRow
            label="Spouse business income"
            helper="Growing businesses start at $0 — enter what you expect"
            currentMonthly={Math.round(s.spouseBusinessRevenue / 12)}
            m12={spouseMonthly12} m36={spouseMonthly36}
            onM12={setSpouseMonthly12} onM36={setSpouseMonthly36}
          />
        )}
        {showDigital && (
          <IncomeRow
            label="Digital products & content income"
            helper="Courses, newsletters, software, consulting"
            currentMonthly={0}
            m12={digitalMonthly12} m36={digitalMonthly36}
            onM12={setDigitalMonthly12} onM36={setDigitalMonthly36}
          />
        )}

        {saveError && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700">{saveError}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving || assetSelections.size === 0}
          className="w-full py-4 rounded-2xl bg-[#1B3A2D] text-white font-bold text-base hover:bg-[#152d22] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition flex items-center justify-center gap-2"
        >
          {saving
            ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
            : 'Build my freedom plan →'
          }
        </button>
      </div>
    );
  }

  // ── Step labels for header ─────────────────────────────────────────────────

  const stepLabels: Record<number, string> = {
    1: 'Stability Check',
    2: 'Tax Commitment',
    3: 'Asset Direction',
    4: 'Timeline & Constraints',
    5: 'Growth Projections',
  };

  const showBackBtn = step > (needsSection1 ? 1 : 2);

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{SLIDER_CSS}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <SectionLabel text="Phase 2 of 2 — Where You're Going" />
            <p className="text-xs text-gray-400">{stepLabels[step]}</p>
          </div>
          <ProgressDots total={5} current={step} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-12">

        {/* Back button */}
        {showBackBtn && (
          <button
            onClick={back}
            className="mb-5 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
        )}

        {step === 1 && renderSection1()}
        {step === 2 && renderSection2()}
        {step === 3 && renderSection3()}
        {step === 4 && renderSection4()}
        {step === 5 && renderSection5()}
      </main>
    </div>
  );
}

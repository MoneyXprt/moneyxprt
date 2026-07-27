'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { saveSnapshot, getLatestSnapshot } from '@/app/lib/snapshots';
import { computeDebtPayoffOrder } from '@/app/lib/debtPayoff';
import { syncFinancialPhase } from '@/app/lib/financialPhaseSync';
import { syncCapitalPerYear } from '@/app/lib/capitalPerYearSync';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';
import type { Session } from '@supabase/supabase-js';

// ─── Form state ───────────────────────────────────────────────────────────────

// Live snapshot of a debt already tracked in the `debts` table, keyed by debt_type.
// Presence of an entry means Section 4 shows that debt type read-only, sourced from
// here instead of the editable financial_snapshots fields.
interface TrackedDebt { balance: number; rate: number; payment: number }

interface FormState {
  // S1 — Income
  w2Income: string; bonusIncome: string; bonusDefers: boolean; bonusDeferred: string;
  bonusFrequency: 'monthly' | 'quarterly' | 'annual' | ''; bonusPlanAmount: string; bonusPaymentMonth: string;
  income1099: string; carAllowanceAnnual: string; otherIncomeAnnual: string;
  monthlyRentalIncome: string; monthlyDividendIncome: string;
  spouseWorks: boolean; spouseIncomeType: 'w2' | 'self_employment' | 'both' | '';
  spouseW2Income: string; spouseBusinessRevenue: string; spouseBusinessNetProfit: string;
  // S2 — Tax
  filingStatus: 'single' | 'mfj' | 'hoh'; state: string; currentTaxPaid: string;
  hasBusinessEntity: boolean; businessRevenue: string; primaryBusinessNetProfit: string;
  primaryBusinessType: string; primaryHoursPerWeekInBusiness: string;
  hasDedicatedHomeOffice: boolean; homeOfficeSquareFootage: string;
  spouseHasSeparateBusiness: boolean; spouseBusinessType: string;
  hasHsaAvailable: boolean; employer401kAllowsAfterTax: boolean | undefined;
  hasCpa: boolean | undefined; cpaProactive: boolean | undefined;
  // S3 — Balance Sheet
  primaryResidenceValue: string; mortgageBalance: string;
  currentlyOwnsRental: boolean; rentalPropertyValue: string; rentalMortgageBalance: string;
  retirementBalance: string; traditionalIraBalance: string;
  taxableBrokerageBalance: string; businessEquityValue: string;
  // S4 — Liabilities
  hasCarLoan: boolean; hasStudentLoan: boolean; hasPersonalLoan: boolean;
  hasCreditCard: boolean; hasBusinessLoan: boolean; hasOtherDebt: boolean;
  carLoanBalance: string; carLoanRate: string; carLoanPayment: string;
  studentLoanBalance: string; studentLoanRate: string; studentLoanPayment: string;
  personalLoanBalance: string; personalLoanRate: string; personalLoanPayment: string;
  creditCardBalance: string; creditCardRate: string; creditCardPayment: string;
  businessLoanBalance: string; businessLoanRate: string; businessLoanPayment: string;
  otherDebtLabel: string; otherDebtBalance: string; otherDebtRate: string; otherDebtPayment: string;
  // Debt-tracker sync only — original starting balance per debt, optional (falls
  // back to current balance if left blank). Not part of FinancialSnapshot; only read
  // by syncDebtsTracker.
  carLoanOriginalBalance: string; studentLoanOriginalBalance: string;
  personalLoanOriginalBalance: string; creditCardOriginalBalance: string;
  businessLoanOriginalBalance: string; otherDebtOriginalBalance: string;
  // S5 — Cash Flow
  essentialMonthlySpend: string; discretionaryMonthlySpend: string; emergencyFund: string;
  extraDebtPayments: string;
  childSupportMonthly: string; alimonyMonthly: string;
  // S6 — Household
  dependentsUnder18: string; dependentAges: string; spouseHoursPerWeekInBusiness: string;
}

const EMPTY: FormState = {
  w2Income: '', bonusIncome: '', bonusDefers: false, bonusDeferred: '',
  bonusFrequency: '', bonusPlanAmount: '', bonusPaymentMonth: '',
  income1099: '', carAllowanceAnnual: '', otherIncomeAnnual: '',
  monthlyRentalIncome: '', monthlyDividendIncome: '',
  spouseWorks: false, spouseIncomeType: '', spouseW2Income: '',
  spouseBusinessRevenue: '', spouseBusinessNetProfit: '',
  filingStatus: 'mfj', state: 'CA', currentTaxPaid: '',
  hasBusinessEntity: false, businessRevenue: '', primaryBusinessNetProfit: '',
  primaryBusinessType: '', primaryHoursPerWeekInBusiness: '',
  hasDedicatedHomeOffice: false, homeOfficeSquareFootage: '',
  spouseHasSeparateBusiness: false, spouseBusinessType: '',
  hasHsaAvailable: false, employer401kAllowsAfterTax: undefined,
  hasCpa: undefined, cpaProactive: undefined,
  primaryResidenceValue: '', mortgageBalance: '',
  currentlyOwnsRental: false, rentalPropertyValue: '', rentalMortgageBalance: '',
  retirementBalance: '', traditionalIraBalance: '', taxableBrokerageBalance: '', businessEquityValue: '',
  hasCarLoan: false, hasStudentLoan: false, hasPersonalLoan: false,
  hasCreditCard: false, hasBusinessLoan: false, hasOtherDebt: false,
  carLoanBalance: '', carLoanRate: '', carLoanPayment: '',
  studentLoanBalance: '', studentLoanRate: '', studentLoanPayment: '',
  personalLoanBalance: '', personalLoanRate: '', personalLoanPayment: '',
  creditCardBalance: '', creditCardRate: '', creditCardPayment: '',
  businessLoanBalance: '', businessLoanRate: '', businessLoanPayment: '',
  otherDebtLabel: '', otherDebtBalance: '', otherDebtRate: '', otherDebtPayment: '',
  carLoanOriginalBalance: '', studentLoanOriginalBalance: '',
  personalLoanOriginalBalance: '', creditCardOriginalBalance: '',
  businessLoanOriginalBalance: '', otherDebtOriginalBalance: '',
  essentialMonthlySpend: '', discretionaryMonthlySpend: '', emergencyFund: '',
  extraDebtPayments: '',
  childSupportMonthly: '', alimonyMonthly: '',
  dependentsUnder18: '', dependentAges: '', spouseHoursPerWeekInBusiness: '',
};

const n = (v: string) => (v === '' ? 0 : parseFloat(v.replace(/,/g, '')) || 0);
const rnd = (v: number, nearest: number) => v > 0 ? String(Math.round(v / nearest) * nearest) : '';

function snapshotToForm(s: FinancialSnapshot): FormState {
  return {
    w2Income:           String(s.w2Income || ''),
    bonusIncome:        String(s.bonusIncome || ''),
    bonusDefers:        s.bonusDeferred > 0,
    bonusDeferred:      String(s.bonusDeferred || ''),
    // bonus_plan is a separate table, not part of FinancialSnapshot — populated by a
    // second fetch right after this runs (see the pre-populate effect).
    bonusFrequency:     '',
    bonusPlanAmount:    '',
    bonusPaymentMonth:  '',
    income1099:         String(s.income1099 || ''),
    carAllowanceAnnual: String(s.carAllowanceAnnual || ''),
    otherIncomeAnnual:  String(s.otherIncomeAnnual || ''),
    monthlyRentalIncome:   String(s.monthlyRentalIncome || ''),
    monthlyDividendIncome: String(s.monthlyDividendIncome || ''),
    spouseWorks:        s.spouseWorks,
    spouseIncomeType:   s.spouseW2Income > 0 && s.spouseBusinessRevenue > 0 ? 'both'
                      : s.spouseW2Income > 0 ? 'w2'
                      : s.spouseBusinessRevenue > 0 ? 'self_employment' : '',
    spouseW2Income:          String(s.spouseW2Income || ''),
    spouseBusinessRevenue:   String(s.spouseBusinessRevenue || ''),
    spouseBusinessNetProfit: String(s.spouseBusinessNetProfit || ''),
    filingStatus:       s.filingStatus,
    state:              s.state,
    currentTaxPaid:     rnd(s.currentTaxPaid, 5000),
    hasBusinessEntity:              s.hasBusinessEntity,
    businessRevenue:                String(s.businessRevenue || ''),
    primaryBusinessNetProfit:       String(s.primaryBusinessNetProfit || ''),
    primaryBusinessType:            s.primaryBusinessType || '',
    primaryHoursPerWeekInBusiness:  String(s.primaryHoursPerWeekInBusiness || ''),
    hasDedicatedHomeOffice:         s.hasDedicatedHomeOffice,
    homeOfficeSquareFootage:        String(s.homeOfficeSquareFootage || ''),
    spouseHasSeparateBusiness:  s.spouseBusinessType !== '',
    spouseBusinessType:         s.spouseBusinessType || '',
    hasHsaAvailable:     s.hasHsaAvailable,
    employer401kAllowsAfterTax: s.employer401kAllowsAfterTax,
    hasCpa:              s.hasCpa,
    cpaProactive:        s.cpaProactive,
    primaryResidenceValue: rnd(s.primaryResidenceValue, 10000),
    mortgageBalance:       rnd(s.mortgageBalance, 10000),
    currentlyOwnsRental:   s.currentlyOwnsRental,
    rentalPropertyValue:   rnd(s.rentalPropertyValue, 10000),
    rentalMortgageBalance: rnd(s.rentalMortgageBalance, 10000),
    retirementBalance:     rnd(s.retirementBalance, 5000),
    traditionalIraBalance: rnd(s.traditionalIraBalance, 100),
    taxableBrokerageBalance: rnd(s.taxableBrokerageBalance, 1000),
    businessEquityValue:   rnd(s.businessEquityValue, 10000),
    hasCarLoan:     s.carLoanBalance > 0,
    hasStudentLoan: s.studentLoanBalance > 0,
    hasPersonalLoan: s.personalLoanBalance > 0,
    hasCreditCard:  s.creditCardBalance > 0,
    hasBusinessLoan: s.businessLoanBalance > 0,
    carLoanBalance:  String(s.carLoanBalance || ''),
    carLoanRate:     String(s.carLoanRate || ''),
    carLoanPayment:  String(s.carLoanPayment || ''),
    studentLoanBalance: String(s.studentLoanBalance || ''),
    studentLoanRate:    String(s.studentLoanRate || ''),
    studentLoanPayment: String(s.studentLoanPayment || ''),
    personalLoanBalance: String(s.personalLoanBalance || ''),
    personalLoanRate:    String(s.personalLoanRate || ''),
    personalLoanPayment: String(s.personalLoanPayment || ''),
    creditCardBalance:   String(s.creditCardBalance || ''),
    creditCardRate:      String(s.creditCardRate || ''),
    creditCardPayment:   String(s.creditCardPayment || ''),
    businessLoanBalance: String(s.businessLoanBalance || ''),
    businessLoanRate:    String(s.businessLoanRate || ''),
    businessLoanPayment: String(s.businessLoanPayment || ''),
    hasOtherDebt: s.otherDebtBalance > 0 || s.otherDebtLabel.trim() !== '',
    otherDebtLabel:   s.otherDebtLabel || '',
    otherDebtBalance: String(s.otherDebtBalance || ''),
    otherDebtRate:    String(s.otherDebtRate || ''),
    otherDebtPayment: String(s.otherDebtPayment || ''),
    // Migration-only fields — never persisted, always blank on reload.
    carLoanOriginalBalance: '', studentLoanOriginalBalance: '',
    personalLoanOriginalBalance: '', creditCardOriginalBalance: '',
    businessLoanOriginalBalance: '', otherDebtOriginalBalance: '',
    essentialMonthlySpend:      rnd(s.essentialMonthlySpend, 500),
    discretionaryMonthlySpend:  rnd(s.discretionaryMonthlySpend, 100),
    emergencyFund:              rnd(s.emergencyFund, 1000),
    // No backing FinancialSnapshot field yet (next step).
    extraDebtPayments: '',
    childSupportMonthly: String(s.childSupportMonthly || ''),
    alimonyMonthly:      String(s.alimonyMonthly || ''),
    dependentsUnder18: String(s.dependentsUnder18 || ''),
    dependentAges:     s.dependentAges || '',
    spouseHoursPerWeekInBusiness: String(s.spouseHoursPerWeekInBusiness || ''),
  };
}

const SECTIONS = [
  { label: 'Income' },
  { label: 'Tax Situation' },
  { label: 'Balance Sheet' },
  { label: 'Liabilities' },
  { label: 'Cash Flow' },
  { label: 'Household' },
];

const US_STATES = [
  { value: 'CA', label: 'California (CA)' },
  { value: 'NY', label: 'New York (NY)' },
  { value: 'NJ', label: 'New Jersey (NJ)' },
  { value: 'TX', label: 'Texas (TX)' },
  { value: 'FL', label: 'Florida (FL)' },
  { value: 'WA', label: 'Washington (WA)' },
  { value: 'NV', label: 'Nevada (NV)' },
  { value: 'OTHER', label: 'Other' },
];

const MONTH_OPTIONS = [
  { value: '1',  label: 'January' },   { value: '2',  label: 'February' },
  { value: '3',  label: 'March' },     { value: '4',  label: 'April' },
  { value: '5',  label: 'May' },       { value: '6',  label: 'June' },
  { value: '7',  label: 'July' },      { value: '8',  label: 'August' },
  { value: '9',  label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' },  { value: '12', label: 'December' },
];

// ─── UI components ────────────────────────────────────────────────────────────

const BASE_INPUT = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition';

function DollarInput({ label, hint, value, onChange, placeholder = '0' }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">$</span>
        <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`${BASE_INPUT} pl-7`} />
      </div>
    </div>
  );
}

function SuffixInput({ label, hint, value, onChange, placeholder = '0', suffix }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; suffix: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <div className="relative">
        <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`${BASE_INPUT} pr-16`} />
        <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 text-xs pointer-events-none">{suffix}</span>
      </div>
    </div>
  );
}

function TextInput({ label, hint, value, onChange, placeholder = '' }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={BASE_INPUT} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className={`${BASE_INPUT} bg-gray-50 text-gray-500 cursor-not-allowed`}>{value}</div>
    </div>
  );
}

function TrackedInDebtsNote() {
  return (
    <p className="text-xs text-gray-400 leading-relaxed">
      Tracked in Debts — log payments and see progress there.{' '}
      <a href="/dashboard/debts" className="text-emerald-600 font-medium hover:underline">Go to Debts →</a>
    </p>
  );
}

function PaidOffNote() {
  return (
    <p className="text-xs text-emerald-600 font-medium leading-relaxed">
      ✓ Paid off — see Debts page.{' '}
      <a href="/dashboard/debts" className="text-emerald-600 underline">Go to Debts →</a>
    </p>
  );
}

function SelectInput({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`${BASE_INPUT} bg-white`}>
        {children}
      </select>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <div className="inline-flex rounded-xl overflow-hidden border border-gray-200">
        {([true, false] as const).map(opt => (
          <button key={String(opt)} type="button" onClick={() => onChange(opt)}
            className={`px-5 py-2 text-xs font-medium transition ${value === opt ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            {opt ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreeWayToggle({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean | undefined; onChange: (v: boolean | undefined) => void;
}) {
  const opts: { label: string; value: boolean | undefined }[] = [
    { label: 'Yes', value: true }, { label: 'No', value: false }, { label: 'Not sure', value: undefined },
  ];
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <div className="inline-flex rounded-xl overflow-hidden border border-gray-200">
        {opts.map(opt => (
          <button key={opt.label} type="button" onClick={() => onChange(opt.value)}
            className={`px-4 py-2 text-xs font-medium transition ${value === opt.value ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide pt-1">{label}</p>;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-semibold text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await getBrowserSupabaseClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard/audit` },
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
        <h1 className="text-xl font-semibold text-gray-900">Sign in to continue</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">We&apos;ll send a one-click sign-in link.</p>
        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4">
            <p className="text-sm font-medium text-emerald-700">Check your email</p>
            <p className="mt-0.5 text-sm text-emerald-600">Link sent to <strong>{email}</strong></p>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className={BASE_INPUT} />
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

export default function AuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const freshParam = searchParams.get('fresh') === 'true';

  const [session, setSession]       = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [section, setSection]       = useState(1);
  const [form, setForm]             = useState<FormState>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState(false);
  const [trackedDebts, setTrackedDebts] = useState<Record<string, TrackedDebt>>({});
  const [paidOffDebtTypes, setPaidOffDebtTypes] = useState<Set<string>>(new Set());

  // ── Auth + pre-populate ──────────────────────────────────────────────────
  useEffect(() => {
    const isFresh = freshParam ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('mxprt_fresh_audit') === '1');
    if (isFresh && typeof sessionStorage !== 'undefined') sessionStorage.removeItem('mxprt_fresh_audit');

    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s && !isFresh) {
        try {
          const latest = await getLatestSnapshot();
          if (latest) setForm(snapshotToForm(latest));
        } catch { /* first visit */ }
        try {
          const { data: bonusPlan } = await sb
            .from('bonus_plan')
            .select('frequency, plan_amount, payment_month')
            .eq('user_id', s.user.id)
            .maybeSingle();
          if (bonusPlan) {
            setForm(prev => ({
              ...prev,
              bonusFrequency: bonusPlan.frequency as FormState['bonusFrequency'],
              bonusPlanAmount: bonusPlan.frequency === 'monthly' ? '' : String(bonusPlan.plan_amount ?? ''),
              bonusPaymentMonth: bonusPlan.payment_month != null ? String(bonusPlan.payment_month) : '',
            }));
          }
        } catch { /* no bonus plan saved yet */ }
        try {
          // Debts already tracked in the `debts` table are the source of truth for
          // Section 4 — fetched the same way syncDebtsTracker checks for existing rows
          // (unique per user_id + debt_type). Active rows drive the read-only display;
          // paid-off rows (is_active = false) are flagged separately so the section
          // shows a "paid off" note instead of reopening editable inputs — otherwise the
          // user could re-enter a balance for a debt that's already settled, creating a
          // conflicting entry. Also overwrite the matching form fields with the live
          // values so a later save doesn't push a stale rate/payment from this snapshot
          // back over an edit made on the Debts page.
          const { data: debtRows } = await sb
            .from('debts')
            .select('debt_type, current_balance, interest_rate, minimum_payment, is_active')
            .eq('user_id', s.user.id);
          if (debtRows && debtRows.length > 0) {
            const map: Record<string, TrackedDebt> = {};
            const paidOff = new Set<string>();
            for (const d of debtRows) {
              if (d.is_active) {
                map[d.debt_type] = {
                  balance: Number(d.current_balance),
                  rate: Number(d.interest_rate),
                  payment: Number(d.minimum_payment),
                };
              } else {
                paidOff.add(d.debt_type);
              }
            }
            setTrackedDebts(map);
            setPaidOffDebtTypes(paidOff);
            setForm(prev => ({
              ...prev,
              // Paid-off types are forced false (not just left alone) — otherwise a
              // stale true from a prior load would keep feeding a stale, non-zeroed
              // balance into financial_snapshots on save. Active-tracked types are
              // forced true as before.
              hasCarLoan:      paidOff.has('car_loan')      ? false : (prev.hasCarLoan      || !!map.car_loan),
              hasStudentLoan:  paidOff.has('student_loan')  ? false : (prev.hasStudentLoan  || !!map.student_loan),
              hasPersonalLoan: paidOff.has('personal_loan') ? false : (prev.hasPersonalLoan || !!map.personal_loan),
              hasCreditCard:   paidOff.has('credit_card')   ? false : (prev.hasCreditCard   || !!map.credit_card),
              hasBusinessLoan: paidOff.has('business_loan') ? false : (prev.hasBusinessLoan || !!map.business_loan),
              hasOtherDebt:    paidOff.has('other')         ? false : (prev.hasOtherDebt    || !!map.other),
              carLoanBalance:      map.car_loan      ? String(map.car_loan.balance)      : paidOff.has('car_loan')      ? '0' : prev.carLoanBalance,
              carLoanRate:         map.car_loan      ? String(map.car_loan.rate)         : paidOff.has('car_loan')      ? '0' : prev.carLoanRate,
              carLoanPayment:      map.car_loan      ? String(map.car_loan.payment)      : paidOff.has('car_loan')      ? '0' : prev.carLoanPayment,
              studentLoanBalance:  map.student_loan  ? String(map.student_loan.balance)  : paidOff.has('student_loan')  ? '0' : prev.studentLoanBalance,
              studentLoanRate:     map.student_loan  ? String(map.student_loan.rate)     : paidOff.has('student_loan')  ? '0' : prev.studentLoanRate,
              studentLoanPayment:  map.student_loan  ? String(map.student_loan.payment)  : paidOff.has('student_loan')  ? '0' : prev.studentLoanPayment,
              personalLoanBalance: map.personal_loan ? String(map.personal_loan.balance) : paidOff.has('personal_loan') ? '0' : prev.personalLoanBalance,
              personalLoanRate:    map.personal_loan ? String(map.personal_loan.rate)    : paidOff.has('personal_loan') ? '0' : prev.personalLoanRate,
              personalLoanPayment: map.personal_loan ? String(map.personal_loan.payment) : paidOff.has('personal_loan') ? '0' : prev.personalLoanPayment,
              creditCardBalance:   map.credit_card   ? String(map.credit_card.balance)   : paidOff.has('credit_card')   ? '0' : prev.creditCardBalance,
              creditCardRate:      map.credit_card   ? String(map.credit_card.rate)      : paidOff.has('credit_card')   ? '0' : prev.creditCardRate,
              creditCardPayment:   map.credit_card   ? String(map.credit_card.payment)   : paidOff.has('credit_card')   ? '0' : prev.creditCardPayment,
              businessLoanBalance: map.business_loan ? String(map.business_loan.balance) : paidOff.has('business_loan') ? '0' : prev.businessLoanBalance,
              businessLoanRate:    map.business_loan ? String(map.business_loan.rate)    : paidOff.has('business_loan') ? '0' : prev.businessLoanRate,
              businessLoanPayment: map.business_loan ? String(map.business_loan.payment) : paidOff.has('business_loan') ? '0' : prev.businessLoanPayment,
              otherDebtBalance:    map.other         ? String(map.other.balance)         : paidOff.has('other')         ? '0' : prev.otherDebtBalance,
              otherDebtRate:       map.other         ? String(map.other.rate)            : paidOff.has('other')         ? '0' : prev.otherDebtRate,
              otherDebtPayment:    map.other         ? String(map.other.payment)         : paidOff.has('other')         ? '0' : prev.otherDebtPayment,
            }));
          }
        } catch { /* no debts tracked yet */ }
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value })), []);

  // ── Submit ───────────────────────────────────────────────────────────────
  // Section 1's bonus-amount requirement is validated at "Next" time (see handleNext)
  // so the user sees the error immediately rather than after clicking through every
  // section — by the time handleSubmit runs, section 1 has already been validated.
  const handleNext = () => {
    if (section === 1 && (form.bonusFrequency === 'quarterly' || form.bonusFrequency === 'annual')) {
      if (n(form.bonusPlanAmount) <= 0) {
        setSaveError('Enter your estimated bonus amount before continuing.');
        return;
      }
      if (!form.bonusPaymentMonth) {
        setSaveError('Select the month your bonus is typically paid.');
        return;
      }
    }
    setSaveError(null);
    setSection(s => s + 1);
  };

  const handleSubmit = async () => {
    setSaving(true); setSaveError(null); setSyncWarning(false);
    try {
      const essential     = n(form.essentialMonthlySpend);
      const discretionary = n(form.discretionaryMonthlySpend);
      const grossBonus    = n(form.bonusIncome);
      const bonusDeferred = form.bonusDefers ? Math.min(n(form.bonusDeferred), grossBonus) : 0;
      // A spouse's separate business entity also satisfies IRC §280A(g) Augusta Rule
      // eligibility (and every other hasBusinessEntity-gated strategy) — it's a real
      // entity on the joint return, not specifically the user's own sole-proprietorship.
      const effectiveHasBusinessEntity = form.hasBusinessEntity || (form.spouseWorks && form.spouseHasSeparateBusiness);

      const snapshot: FinancialSnapshot = {
        w2Income:           n(form.w2Income),
        bonusIncome:        grossBonus,
        bonusDeferred,
        bonusTakenAsCash:   grossBonus - bonusDeferred,
        income1099:         n(form.income1099),
        carAllowanceAnnual: n(form.carAllowanceAnnual),
        otherIncomeAnnual:  n(form.otherIncomeAnnual),
        spouseWorks:        form.spouseWorks,
        filingStatus:       form.filingStatus === 'hoh' ? 'single' : form.filingStatus,
        state:              form.state,
        dependentsUnder18:  n(form.dependentsUnder18),
        dependentAges:      form.dependentAges.trim(),
        hasBusinessEntity:              effectiveHasBusinessEntity,
        businessRevenue:                form.hasBusinessEntity ? n(form.businessRevenue) : 0,
        primaryBusinessNetProfit:       form.hasBusinessEntity ? n(form.primaryBusinessNetProfit) : 0,
        primaryBusinessType:            form.hasBusinessEntity ? form.primaryBusinessType : '',
        primaryHoursPerWeekInBusiness:  form.hasBusinessEntity ? n(form.primaryHoursPerWeekInBusiness) : 0,
        hasDedicatedHomeOffice:         effectiveHasBusinessEntity ? form.hasDedicatedHomeOffice : false,
        homeOfficeSquareFootage:        effectiveHasBusinessEntity ? n(form.homeOfficeSquareFootage) : 0,
        spouseW2Income:  form.spouseWorks && (form.spouseIncomeType === 'w2' || form.spouseIncomeType === 'both')
                           ? n(form.spouseW2Income) : 0,
        spouseBusinessRevenue:  form.spouseWorks && (form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both')
                                  ? n(form.spouseBusinessRevenue) : 0,
        spouseBusinessNetProfit: form.spouseWorks && (form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both')
                                   ? n(form.spouseBusinessNetProfit) : 0,
        spouseBusinessType:  form.spouseWorks && form.spouseHasSeparateBusiness ? form.spouseBusinessType : '',
        spouseHoursPerWeekInBusiness: form.spouseWorks ? n(form.spouseHoursPerWeekInBusiness) : 0,
        currentTaxPaid:      n(form.currentTaxPaid),
        hasHsaAvailable:     form.hasHsaAvailable,
        hasCpa:              form.hasCpa ?? false,
        cpaProactive:        form.cpaProactive ?? false,
        primaryResidenceValue: n(form.primaryResidenceValue),
        mortgageBalance:       n(form.mortgageBalance),
        homeEquity:          Math.max(0, n(form.primaryResidenceValue) - n(form.mortgageBalance)),
        currentlyOwnsRental: form.currentlyOwnsRental,
        rentalPropertyValue: form.currentlyOwnsRental ? n(form.rentalPropertyValue) : 0,
        rentalMortgageBalance: form.currentlyOwnsRental ? n(form.rentalMortgageBalance) : 0,
        retirementBalance:   n(form.retirementBalance),
        traditionalIraBalance: n(form.traditionalIraBalance),
        taxableBrokerageBalance: n(form.taxableBrokerageBalance),
        businessEquityValue:   form.hasBusinessEntity ? n(form.businessEquityValue) : 0,
        monthlyRentalIncome:   n(form.monthlyRentalIncome),
        monthlyDividendIncome: n(form.monthlyDividendIncome),
        essentialMonthlySpend:     essential,
        discretionaryMonthlySpend: discretionary,
        monthlySpend:              essential + discretionary,
        emergencyFund:         n(form.emergencyFund),
        extraDebtPayments:     n(form.extraDebtPayments),
        childSupportMonthly:   n(form.childSupportMonthly),
        alimonyMonthly:        n(form.alimonyMonthly),
        carLoanBalance:   form.hasCarLoan ? n(form.carLoanBalance) : 0,
        carLoanRate:      form.hasCarLoan ? n(form.carLoanRate) : 0,
        carLoanPayment:   form.hasCarLoan ? n(form.carLoanPayment) : 0,
        studentLoanBalance: form.hasStudentLoan ? n(form.studentLoanBalance) : 0,
        studentLoanRate:    form.hasStudentLoan ? n(form.studentLoanRate) : 0,
        studentLoanPayment: form.hasStudentLoan ? n(form.studentLoanPayment) : 0,
        personalLoanBalance: form.hasPersonalLoan ? n(form.personalLoanBalance) : 0,
        personalLoanRate:    form.hasPersonalLoan ? n(form.personalLoanRate) : 0,
        personalLoanPayment: form.hasPersonalLoan ? n(form.personalLoanPayment) : 0,
        creditCardBalance: form.hasCreditCard ? n(form.creditCardBalance) : 0,
        creditCardRate:    form.hasCreditCard ? n(form.creditCardRate) : 0,
        creditCardPayment: form.hasCreditCard ? n(form.creditCardPayment) : 0,
        businessLoanBalance: form.hasBusinessLoan ? n(form.businessLoanBalance) : 0,
        businessLoanRate:    form.hasBusinessLoan ? n(form.businessLoanRate) : 0,
        businessLoanPayment: form.hasBusinessLoan ? n(form.businessLoanPayment) : 0,
        otherDebtLabel:   form.hasOtherDebt ? form.otherDebtLabel.trim() : '',
        otherDebtBalance: form.hasOtherDebt ? n(form.otherDebtBalance) : 0,
        otherDebtRate:    form.hasOtherDebt ? n(form.otherDebtRate) : 0,
        otherDebtPayment: form.hasOtherDebt ? n(form.otherDebtPayment) : 0,
        debts: [
          ...(form.hasCarLoan ? [{ type: 'car', balance: n(form.carLoanBalance), rate: n(form.carLoanRate) / 100, payment: n(form.carLoanPayment) }] : []),
          ...(form.hasStudentLoan ? [{ type: 'student', balance: n(form.studentLoanBalance), rate: n(form.studentLoanRate) / 100, payment: n(form.studentLoanPayment) }] : []),
          ...(form.hasPersonalLoan ? [{ type: 'personal', balance: n(form.personalLoanBalance), rate: n(form.personalLoanRate) / 100, payment: n(form.personalLoanPayment) }] : []),
          ...(form.hasCreditCard ? [{ type: 'creditCard', balance: n(form.creditCardBalance), rate: n(form.creditCardRate) / 100, payment: n(form.creditCardPayment) }] : []),
          ...(form.hasBusinessLoan ? [{ type: 'business', balance: n(form.businessLoanBalance), rate: n(form.businessLoanRate) / 100, payment: n(form.businessLoanPayment) }] : []),
          ...(form.hasOtherDebt ? [{ type: form.otherDebtLabel.trim() || 'other', balance: n(form.otherDebtBalance), rate: n(form.otherDebtRate) / 100, payment: n(form.otherDebtPayment) }] : []),
        ],
        employer401kAllowsAfterTax: form.employer401kAllowsAfterTax,
        // Phase 2 fields — not captured in Phase 1, set to false/undefined
        consideringRealEstate: false,
        plannedPropertyValue:  undefined,
        repsQualified:         undefined,
      };

      await saveSnapshot(snapshot);

      // Bonus plan is a separate table from financial_snapshots — only save it when
      // a frequency has actually been chosen. plan_amount always means "amount per one
      // period of the stated frequency": monthly per-month, quarterly per-quarter,
      // annual per-year. For monthly, no separate plan_amount is captured (per Section 1
      // above), so derive the per-month figure from the existing gross annual bonus;
      // payment_month stays null since it recurs every month.
      if (session && form.bonusFrequency) {
        const { error: bonusPlanError } = await getBrowserSupabaseClient()
          .from('bonus_plan')
          .upsert({
            user_id:       session.user.id,
            frequency:     form.bonusFrequency,
            plan_amount:   form.bonusFrequency === 'monthly' ? grossBonus / 12 : n(form.bonusPlanAmount),
            payment_month: form.bonusFrequency === 'monthly' ? null : (form.bonusPaymentMonth ? Number(form.bonusPaymentMonth) : null),
          }, { onConflict: 'user_id' });
        if (bonusPlanError) throw bonusPlanError;
      }

      // Background sync — never blocks the main Audit save, so each failure is caught
      // individually rather than rethrown. Failures are still surfaced via syncWarning
      // (a visible banner) rather than being console-only, since a failed sync means
      // capital_per_year, financial_phase, or a debt row can go stale in the database
      // with no other indication anything went wrong. The auto-redirect below is
      // skipped in that case — auto-advancing past a warning the user hasn't had a
      // chance to read would sweep it away before they could see it — so they stay on
      // this page and continue manually (retry the save, or the banner's own link).
      let anySyncFailed = false;

      if (session) {
        try {
          await syncDebtsTracker(session.user.id);
        } catch (err) {
          console.warn('syncDebtsTracker failed:', err instanceof Error ? err.message : err);
          anySyncFailed = true;
        }

        // Recompute financial phase — run after syncDebtsTracker so it reflects any
        // debts just synced in, plus the emergencyFund just saved above. Same
        // never-block-the-save treatment as the debt sync.
        try {
          await syncFinancialPhase(getBrowserSupabaseClient(), session.user.id);
        } catch (err) {
          console.warn('syncFinancialPhase failed:', err instanceof Error ? err.message : err);
          anySyncFailed = true;
        }

        // Recompute capital_per_year from the snapshot just saved above — previously
        // this only refreshed when the user manually revisited phase2, so it could go
        // stale relative to Audit changes. Same never-block-the-save treatment.
        try {
          await syncCapitalPerYear(getBrowserSupabaseClient(), session.user.id);
        } catch (err) {
          console.warn('syncCapitalPerYear failed:', err instanceof Error ? err.message : err);
          anySyncFailed = true;
        }
      }

      if (anySyncFailed) {
        setSyncWarning(true);
        setSaving(false);
        return;
      }

      router.push('/dashboard/audit/snapshot-summary' + (freshParam ? '?fresh=true' : ''));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  // ── Debt-tracker sync (silent) ────────────────────────────────────────────
  // Runs on every Audit save. For each debt type with a balance > 0: if no row
  // exists yet for (user_id, debt_type), insert one (using the original-balance
  // fallback below). If a row already exists, only refresh interest_rate,
  // minimum_payment, and name — current_balance is owned by the debt-payment
  // tracking flow (Actuals) once a debt is in the tracker, and must never be
  // silently overwritten here. debt_type has no unique DB constraint, so this is
  // an application-level "find, then insert-or-update" rather than a real upsert.
  // Only re-ranks payoff_order when a new debt was actually inserted this save —
  // pure updates to existing debts don't change balance ordering, so skipping the
  // re-rank avoids unnecessary writes on every plain save.
  const syncDebtsTracker = async (userId: string) => {
    const sb = getBrowserSupabaseClient();

    const entries: {
      debt_type: string; name: string;
      balance: number; originalBalance: number;
      rate: number; payment: number;
    }[] = [];

    if (form.hasCarLoan && n(form.carLoanBalance) > 0) {
      entries.push({
        debt_type: 'car_loan', name: 'Car Loan',
        balance: n(form.carLoanBalance),
        originalBalance: n(form.carLoanOriginalBalance) || n(form.carLoanBalance),
        rate: n(form.carLoanRate), payment: n(form.carLoanPayment),
      });
    }
    if (form.hasStudentLoan && n(form.studentLoanBalance) > 0) {
      entries.push({
        debt_type: 'student_loan', name: 'Student Loan',
        balance: n(form.studentLoanBalance),
        originalBalance: n(form.studentLoanOriginalBalance) || n(form.studentLoanBalance),
        rate: n(form.studentLoanRate), payment: n(form.studentLoanPayment),
      });
    }
    if (form.hasPersonalLoan && n(form.personalLoanBalance) > 0) {
      entries.push({
        debt_type: 'personal_loan', name: 'Personal Loan',
        balance: n(form.personalLoanBalance),
        originalBalance: n(form.personalLoanOriginalBalance) || n(form.personalLoanBalance),
        rate: n(form.personalLoanRate), payment: n(form.personalLoanPayment),
      });
    }
    if (form.hasCreditCard && n(form.creditCardBalance) > 0) {
      entries.push({
        debt_type: 'credit_card', name: 'Credit Card',
        balance: n(form.creditCardBalance),
        originalBalance: n(form.creditCardOriginalBalance) || n(form.creditCardBalance),
        rate: n(form.creditCardRate), payment: n(form.creditCardPayment),
      });
    }
    if (form.hasBusinessLoan && n(form.businessLoanBalance) > 0) {
      entries.push({
        debt_type: 'business_loan', name: 'Business Loan',
        balance: n(form.businessLoanBalance),
        originalBalance: n(form.businessLoanOriginalBalance) || n(form.businessLoanBalance),
        rate: n(form.businessLoanRate), payment: n(form.businessLoanPayment),
      });
    }
    if (form.hasOtherDebt && n(form.otherDebtBalance) > 0) {
      entries.push({
        debt_type: 'other', name: form.otherDebtLabel.trim() || 'Other Debt',
        balance: n(form.otherDebtBalance),
        originalBalance: n(form.otherDebtOriginalBalance) || n(form.otherDebtBalance),
        rate: n(form.otherDebtRate), payment: n(form.otherDebtPayment),
      });
    }

    if (entries.length === 0) return;

    let anyInserted = false;

    for (const entry of entries) {
      const { data: existing, error: findError } = await sb
        .from('debts')
        .select('id')
        .eq('user_id', userId)
        .eq('debt_type', entry.debt_type)
        .maybeSingle();
      if (findError) { console.warn('debts sync lookup failed:', findError.message); continue; }

      if (existing) {
        const { error: updateError } = await sb
          .from('debts')
          .update({ name: entry.name, interest_rate: entry.rate, minimum_payment: entry.payment })
          .eq('id', existing.id);
        if (updateError) console.warn('debts sync update failed:', updateError.message);
      } else {
        const { error: insertError } = await sb.from('debts').insert({
          user_id: userId, name: entry.name, debt_type: entry.debt_type,
          original_balance: entry.originalBalance, current_balance: entry.balance,
          interest_rate: entry.rate, minimum_payment: entry.payment,
        });
        if (insertError) { console.warn('debts sync insert failed:', insertError.message); continue; }
        anyInserted = true;
      }
    }

    if (!anyInserted) return;

    const { data: allDebts } = await sb
      .from('debts')
      .select('id, current_balance, interest_rate, is_active')
      .eq('user_id', userId);

    const ranked = computeDebtPayoffOrder(
      (allDebts ?? []).map(d => ({
        id: d.id,
        currentBalance: Number(d.current_balance),
        interestRate: Number(d.interest_rate),
        isActive: d.is_active,
      })),
      'snowball',
    );

    await Promise.all(
      ranked.map(r => sb.from('debts').update({ payoff_order: r.payoffOrder }).eq('id', r.id)),
    );
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (sessionLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return <AuthGate onSession={setSession} />;

  const isLast = section === SECTIONS.length;
  const totalMonthly = n(form.essentialMonthlySpend) + n(form.discretionaryMonthlySpend);
  const computedHomeEquity = Math.max(0, n(form.primaryResidenceValue) - n(form.mortgageBalance));
  const bonusCash = Math.max(0, n(form.bonusIncome) - (form.bonusDefers ? n(form.bonusDeferred) : 0));
  // Live-render equivalent of handleSubmit's effectiveHasBusinessEntity — gates any UI
  // section whose eligibility depends on a business entity existing anywhere on the
  // joint return (not just the user's own), same as the Augusta Rule save-time fix.
  const effectiveHasBusinessEntity = form.hasBusinessEntity || (form.spouseWorks && form.spouseHasSeparateBusiness);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase">Phase 1 of 2</p>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Where You Are Today</p>
          </div>
          <div className="flex gap-1.5 items-center">
            {SECTIONS.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300" style={{
                height: 6,
                width: i < section - 1 ? 18 : i === section - 1 ? 18 : 7,
                background: i < section - 1 ? '#059669' : i === section - 1 ? '#1B3A2D' : '#E5E7EB',
              }} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Progress label */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-600">
            Section {section} of {SECTIONS.length} — {SECTIONS[section - 1].label}
          </span>
          <span className="text-xs text-gray-400">{Math.round((section / SECTIONS.length) * 100)}%</span>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-gray-50">
            <h1 className="text-base font-bold text-gray-900">{SECTIONS[section - 1].label}</h1>
            <p className="mt-0.5 text-xs text-gray-400">
              {section === 1 && 'Every income source, this year.'}
              {section === 2 && 'Your tax situation and business structure.'}
              {section === 3 && 'What you own today.'}
              {section === 4 && 'What you owe. Skip anything that doesn\'t apply.'}
              {section === 5 && 'How money moves every month.'}
              {section === 6 && 'Household details for strategy calculations.'}
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">

            {/* ── Section 1: Income ─────────────────────────────────── */}
            {section === 1 && (<>
              <DollarInput label="W-2 base salary" hint="Gross annual salary before taxes."
                value={form.w2Income} onChange={v => set('w2Income', v)} />

              <DollarInput label="Gross bonus / profit share"
                hint="Total expected bonus before any deferral."
                value={form.bonusIncome}
                onChange={v => { set('bonusIncome', v); if (n(form.bonusDeferred) > n(v)) set('bonusDeferred', v); }} />

              {n(form.bonusIncome) > 0 && (
                <div className="pl-4 border-l-2 border-emerald-100 space-y-4">
                  <Toggle label="Do you defer any of this?"
                    hint="Deferred comp you won't receive as cash this year."
                    value={form.bonusDefers}
                    onChange={v => { set('bonusDefers', v); if (!v) set('bonusDeferred', ''); }} />
                  {form.bonusDefers && (<>
                    <DollarInput label="Amount deferred (not taxable this year)"
                      value={form.bonusDeferred}
                      onChange={v => { const c = Math.min(n(v), n(form.bonusIncome)); set('bonusDeferred', c === n(v) ? v : String(c)); }} />
                    <StatRow label="Taken as cash this year" value={`$${bonusCash.toLocaleString()}`} />
                  </>)}

                  <SelectInput label="How is your bonus paid?"
                    value={form.bonusFrequency}
                    onChange={v => { set('bonusFrequency', v as FormState['bonusFrequency']); setSaveError(null); }}>
                    <option value="">Select…</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annually</option>
                  </SelectInput>

                  {(form.bonusFrequency === 'quarterly' || form.bonusFrequency === 'annual') && (
                    <div className="pl-4 border-l-2 border-emerald-100 space-y-4">
                      <DollarInput label="Estimated bonus amount"
                        hint={form.bonusFrequency === 'quarterly'
                          ? 'Amount paid each quarter.'
                          : 'Amount paid once a year.'}
                        value={form.bonusPlanAmount} onChange={v => { set('bonusPlanAmount', v); setSaveError(null); }} />
                      <SelectInput label="What month is it typically paid?"
                        value={form.bonusPaymentMonth}
                        onChange={v => { set('bonusPaymentMonth', v); setSaveError(null); }}>
                        <option value="">Select…</option>
                        {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </SelectInput>
                      {form.bonusFrequency === 'quarterly' && (
                        <p className="text-xs text-gray-400 leading-relaxed">
                          This is your reference quarter — the other three quarterly payments are assumed 3, 6, and 9 months after this one.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <DollarInput label="1099 / freelance / consulting income"
                hint="Any self-employment income not from a business entity."
                value={form.income1099} onChange={v => set('income1099', v)} />

              <DollarInput label="Car allowance or employer-paid benefits (annual)"
                hint="Taxable car allowance, cell phone reimbursements, etc."
                value={form.carAllowanceAnnual} onChange={v => set('carAllowanceAnnual', v)} />

              <DollarInput label="Other regular income (annual)"
                hint="Rental income, dividends, royalties — anything else recurring."
                value={form.otherIncomeAnnual} onChange={v => set('otherIncomeAnnual', v)} />

              <DollarInput label="Current monthly rental income"
                hint="From any rental properties you currently own. Leave blank if none."
                value={form.monthlyRentalIncome} onChange={v => set('monthlyRentalIncome', v)} />

              <DollarInput label="Current monthly dividend / investment income"
                hint="Regular distributions from stocks, funds, REITs. Exclude one-time gains."
                value={form.monthlyDividendIncome} onChange={v => set('monthlyDividendIncome', v)} />

              <Toggle label="Does your spouse or partner have income?"
                hint="Includes employment, self-employment, or business income."
                value={form.spouseWorks}
                onChange={v => { set('spouseWorks', v); if (!v) { set('spouseIncomeType', ''); set('spouseW2Income', ''); set('spouseBusinessRevenue', ''); set('spouseBusinessNetProfit', ''); } }} />

              {form.spouseWorks && (
                <div className="pl-4 border-l-2 border-emerald-100 space-y-4">
                  <Divider label="Spouse income" />
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">Income type</label>
                    <div className="flex flex-col gap-2">
                      {([
                        { value: 'w2', label: 'W-2 Employment' },
                        { value: 'self_employment', label: 'Self-Employment / Business' },
                        { value: 'both', label: 'Both' },
                      ] as const).map(opt => (
                        <button key={opt.value} type="button" onClick={() => set('spouseIncomeType', opt.value)}
                          className={`flex items-center gap-2.5 text-left px-3.5 py-2.5 rounded-xl border text-xs transition ${
                            form.spouseIncomeType === opt.value
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            form.spouseIncomeType === opt.value ? 'border-emerald-500' : 'border-gray-300'}`}>
                            {form.spouseIncomeType === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                          </div>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(form.spouseIncomeType === 'w2' || form.spouseIncomeType === 'both') && (
                    <DollarInput label="Spouse W-2 income (annual)"
                      value={form.spouseW2Income} onChange={v => set('spouseW2Income', v)} />
                  )}
                  {(form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both') && (<>
                    <DollarInput label="Spouse business gross revenue"
                      hint="Total revenue before expenses."
                      value={form.spouseBusinessRevenue} onChange={v => set('spouseBusinessRevenue', v)} />
                    <DollarInput label="Spouse business net profit"
                      hint="After all business expenses — this is what gets taxed."
                      value={form.spouseBusinessNetProfit} onChange={v => set('spouseBusinessNetProfit', v)} />
                  </>)}
                </div>
              )}
            </>)}

            {/* ── Section 2: Tax Situation ──────────────────────────── */}
            {section === 2 && (<>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Filing status</label>
                <select value={form.filingStatus} onChange={e => set('filingStatus', e.target.value as FormState['filingStatus'])}
                  className={`${BASE_INPUT} bg-white`}>
                  <option value="mfj">Married filing jointly (MFJ)</option>
                  <option value="single">Single</option>
                  <option value="hoh">Head of Household (HOH)</option>
                </select>
              </div>

              <SelectInput label="State of residence" value={form.state} onChange={v => set('state', v)}>
                {US_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </SelectInput>

              <DollarInput label="Estimated federal + state tax paid last year"
                hint="W-2 box 2 + state withholding + any estimated payments."
                value={form.currentTaxPaid} onChange={v => set('currentTaxPaid', v)} />

              <Toggle label="Do you own a business or LLC?"
                hint="Includes sole props, SMLLCs, S-Corps, and partnerships."
                value={form.hasBusinessEntity}
                onChange={v => set('hasBusinessEntity', v)} />

              {form.hasBusinessEntity && (
                <div className="pl-4 border-l-2 border-emerald-100 space-y-4">
                  <Divider label="Your Business" />
                  <DollarInput label="Business gross revenue" value={form.businessRevenue} onChange={v => set('businessRevenue', v)} />
                  <DollarInput label="Business net profit" hint="After all expenses — this is what gets taxed."
                    value={form.primaryBusinessNetProfit} onChange={v => set('primaryBusinessNetProfit', v)} />
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Business type</label>
                    <select value={form.primaryBusinessType} onChange={e => set('primaryBusinessType', e.target.value)}
                      className={`${BASE_INPUT} bg-white`}>
                      <option value="">Select…</option>
                      <option value="sole_prop">Sole Proprietorship</option>
                      <option value="smllc">Single-Member LLC</option>
                      <option value="scorp">S-Corp</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                  <SuffixInput label="Hours per week you spend on this business"
                    hint="Used to size Solo 401k and S-Corp election strategies."
                    suffix="hrs/wk" value={form.primaryHoursPerWeekInBusiness}
                    onChange={v => set('primaryHoursPerWeekInBusiness', v)} placeholder="10" />
                </div>
              )}

              {form.spouseWorks && (form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both') && (
                <div className="pl-4 border-l-2 border-purple-100 space-y-4">
                  <Divider label="Spouse Business Entity" />
                  <Toggle label="Does your spouse have a separate business entity?"
                    value={form.spouseHasSeparateBusiness}
                    onChange={v => { set('spouseHasSeparateBusiness', v); if (!v) set('spouseBusinessType', ''); }} />
                  {form.spouseHasSeparateBusiness && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Spouse business type</label>
                      <select value={form.spouseBusinessType} onChange={e => set('spouseBusinessType', e.target.value)}
                        className={`${BASE_INPUT} bg-white`}>
                        <option value="">Select…</option>
                        <option value="sole_prop">Sole Proprietorship</option>
                        <option value="smllc">Single-Member LLC</option>
                        <option value="scorp">S-Corp</option>
                        <option value="partnership">Partnership</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {effectiveHasBusinessEntity && (
                <div className="pl-4 border-l-2 border-emerald-100 space-y-4">
                  <Divider label="Home Office" />
                  <Toggle label="Do you have a dedicated space used regularly and exclusively for the business?"
                    hint="A desk in a shared family room doesn't qualify — the IRS requires exclusive business use."
                    value={form.hasDedicatedHomeOffice}
                    onChange={v => set('hasDedicatedHomeOffice', v)} />

                  {form.hasDedicatedHomeOffice && (
                    <SuffixInput label="Approximate square footage of that space"
                      hint="Used to size the home office deduction (simplified method: $5/sq ft, up to 300 sq ft)."
                      suffix="sq ft" value={form.homeOfficeSquareFootage}
                      onChange={v => set('homeOfficeSquareFootage', v)} placeholder="150" />
                  )}
                </div>
              )}

              <Toggle label="HSA available through your employer?"
                hint="Requires a High-Deductible Health Plan (HDHP)."
                value={form.hasHsaAvailable} onChange={v => set('hasHsaAvailable', v)} />

              <ThreeWayToggle label="Does your employer 401(k) allow after-tax contributions?"
                hint='Enables the "mega backdoor Roth" strategy. Check with your plan admin.'
                value={form.employer401kAllowsAfterTax}
                onChange={v => set('employer401kAllowsAfterTax', v)} />

              <Toggle label="Do you have a CPA or tax professional?"
                value={form.hasCpa ?? false}
                onChange={v => { set('hasCpa', v); if (!v) set('cpaProactive', undefined); }} />

              {form.hasCpa && (
                <div className="pl-4 border-l-2 border-emerald-100">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">What does your CPA do?</label>
                    <div className="inline-flex rounded-xl overflow-hidden border border-gray-200">
                      {[
                        { label: 'Proactively suggests strategies', value: true },
                        { label: 'Mainly just files my return', value: false },
                      ].map(opt => (
                        <button key={String(opt.value)} type="button" onClick={() => set('cpaProactive', opt.value)}
                          className={`px-3 py-2 text-xs font-medium transition ${
                            form.cpaProactive === opt.value ? 'bg-emerald-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>)}

            {/* ── Section 3: Balance Sheet ──────────────────────────── */}
            {section === 3 && (<>
              <Divider label="Real Estate" />
              <DollarInput label="Primary residence estimated value"
                value={form.primaryResidenceValue} onChange={v => set('primaryResidenceValue', v)} />
              <DollarInput label="Outstanding mortgage balance"
                value={form.mortgageBalance} onChange={v => set('mortgageBalance', v)} />
              {(n(form.primaryResidenceValue) > 0 || n(form.mortgageBalance) > 0) && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                  <StatRow label="Estimated home equity" value={`$${computedHomeEquity.toLocaleString()}`} />
                </div>
              )}

              <Toggle label="Do you currently own a rental property?"
                hint="Yes means you own one today, not that you're considering it."
                value={form.currentlyOwnsRental}
                onChange={v => { set('currentlyOwnsRental', v); if (!v) { set('rentalPropertyValue', ''); set('rentalMortgageBalance', ''); } }} />

              {form.currentlyOwnsRental && (
                <div className="pl-4 border-l-2 border-emerald-100 space-y-4">
                  <DollarInput label="Rental property estimated value"
                    value={form.rentalPropertyValue} onChange={v => set('rentalPropertyValue', v)} />
                  <DollarInput label="Rental mortgage balance (if any)"
                    value={form.rentalMortgageBalance} onChange={v => set('rentalMortgageBalance', v)} />
                </div>
              )}

              <Divider label="Investment Accounts" />
              <DollarInput label="Retirement account balance (401k + IRAs combined)"
                hint="Total across all retirement accounts."
                value={form.retirementBalance} onChange={v => set('retirementBalance', v)} />
              <DollarInput label="Traditional IRA balance specifically"
                hint="Pre-tax IRA balance across all accounts — important for backdoor Roth math."
                value={form.traditionalIraBalance} onChange={v => set('traditionalIraBalance', v)} />
              <DollarInput label="Taxable brokerage account balance"
                hint="Non-retirement investment accounts."
                value={form.taxableBrokerageBalance} onChange={v => set('taxableBrokerageBalance', v)} />

              {form.hasBusinessEntity && (
                <DollarInput label="Business equity (estimated value)"
                  hint="Rough estimate of what your business is worth if sold today."
                  value={form.businessEquityValue} onChange={v => set('businessEquityValue', v)} />
              )}
            </>)}

            {/* ── Section 4: Liabilities ────────────────────────────── */}
            {section === 4 && (<>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Which of these do you currently have?</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'hasCarLoan', label: 'Car loan' },
                    { key: 'hasStudentLoan', label: 'Student loans' },
                    { key: 'hasPersonalLoan', label: 'Personal loan' },
                    { key: 'hasCreditCard', label: 'Credit card debt' },
                    { key: 'hasBusinessLoan', label: 'Business loan' },
                    { key: 'hasOtherDebt', label: 'Other' },
                  ] as { key: keyof FormState; label: string }[]).map(({ key, label }) => {
                    const checked = form[key] as boolean;
                    return (
                      <button key={key} type="button" onClick={() => set(key, !checked as FormState[typeof key])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          checked ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!form.hasCarLoan && !form.hasStudentLoan && !form.hasPersonalLoan && !form.hasCreditCard && !form.hasBusinessLoan && !form.hasOtherDebt
                && paidOffDebtTypes.size === 0 && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                  <p className="text-xs text-emerald-700 font-medium">No debt selected — tap any that apply above, or continue to the next section.</p>
                </div>
              )}

              {(form.hasCarLoan || paidOffDebtTypes.has('car_loan')) && (
                <div className="pl-4 border-l-2 border-blue-100 space-y-3">
                  <Divider label="Car Loan" />
                  {trackedDebts.car_loan ? (<>
                    <ReadOnlyField label="Balance" value={`$${Math.round(trackedDebts.car_loan.balance).toLocaleString()}`} />
                    <ReadOnlyField label="Interest rate" value={`${trackedDebts.car_loan.rate.toFixed(2)}% APR`} />
                    <ReadOnlyField label="Minimum monthly payment" value={`$${Math.round(trackedDebts.car_loan.payment).toLocaleString()}`} />
                    <TrackedInDebtsNote />
                  </>) : paidOffDebtTypes.has('car_loan') ? (
                    <PaidOffNote />
                  ) : (<>
                    <DollarInput label="Balance" value={form.carLoanBalance} onChange={v => set('carLoanBalance', v)} />
                    <SuffixInput label="Interest rate" suffix="% APR" value={form.carLoanRate} onChange={v => set('carLoanRate', v)} placeholder="6.5" />
                    <DollarInput label="Minimum monthly payment" value={form.carLoanPayment} onChange={v => set('carLoanPayment', v)} />
                    <DollarInput label="Original loan amount (if different from current balance)"
                      hint="Optional — used only for the debt tracker's records. Leave blank to use the current balance."
                      value={form.carLoanOriginalBalance} onChange={v => set('carLoanOriginalBalance', v)} />
                  </>)}
                </div>
              )}
              {(form.hasStudentLoan || paidOffDebtTypes.has('student_loan')) && (
                <div className="pl-4 border-l-2 border-purple-100 space-y-3">
                  <Divider label="Student Loans" />
                  {trackedDebts.student_loan ? (<>
                    <ReadOnlyField label="Total balance" value={`$${Math.round(trackedDebts.student_loan.balance).toLocaleString()}`} />
                    <ReadOnlyField label="Average interest rate" value={`${trackedDebts.student_loan.rate.toFixed(2)}% APR`} />
                    <ReadOnlyField label="Minimum monthly payment" value={`$${Math.round(trackedDebts.student_loan.payment).toLocaleString()}`} />
                    <TrackedInDebtsNote />
                  </>) : paidOffDebtTypes.has('student_loan') ? (
                    <PaidOffNote />
                  ) : (<>
                    <DollarInput label="Total balance" value={form.studentLoanBalance} onChange={v => set('studentLoanBalance', v)} />
                    <SuffixInput label="Average interest rate" suffix="% APR" value={form.studentLoanRate} onChange={v => set('studentLoanRate', v)} placeholder="6.0" />
                    <DollarInput label="Minimum monthly payment" value={form.studentLoanPayment} onChange={v => set('studentLoanPayment', v)} />
                    <DollarInput label="Original loan amount (if different from current balance)"
                      hint="Optional — used only for the debt tracker's records. Leave blank to use the current balance."
                      value={form.studentLoanOriginalBalance} onChange={v => set('studentLoanOriginalBalance', v)} />
                  </>)}
                </div>
              )}
              {(form.hasPersonalLoan || paidOffDebtTypes.has('personal_loan')) && (
                <div className="pl-4 border-l-2 border-orange-100 space-y-3">
                  <Divider label="Personal Loan" />
                  {trackedDebts.personal_loan ? (<>
                    <ReadOnlyField label="Balance" value={`$${Math.round(trackedDebts.personal_loan.balance).toLocaleString()}`} />
                    <ReadOnlyField label="Interest rate" value={`${trackedDebts.personal_loan.rate.toFixed(2)}% APR`} />
                    <ReadOnlyField label="Minimum monthly payment" value={`$${Math.round(trackedDebts.personal_loan.payment).toLocaleString()}`} />
                    <TrackedInDebtsNote />
                  </>) : paidOffDebtTypes.has('personal_loan') ? (
                    <PaidOffNote />
                  ) : (<>
                    <DollarInput label="Balance" value={form.personalLoanBalance} onChange={v => set('personalLoanBalance', v)} />
                    <SuffixInput label="Interest rate" suffix="% APR" value={form.personalLoanRate} onChange={v => set('personalLoanRate', v)} placeholder="9.0" />
                    <DollarInput label="Minimum monthly payment" value={form.personalLoanPayment} onChange={v => set('personalLoanPayment', v)} />
                    <DollarInput label="Original loan amount (if different from current balance)"
                      hint="Optional — used only for the debt tracker's records. Leave blank to use the current balance."
                      value={form.personalLoanOriginalBalance} onChange={v => set('personalLoanOriginalBalance', v)} />
                  </>)}
                </div>
              )}
              {(form.hasCreditCard || paidOffDebtTypes.has('credit_card')) && (
                <div className="pl-4 border-l-2 border-red-100 space-y-3">
                  <Divider label="Credit Card Debt" />
                  {trackedDebts.credit_card ? (<>
                    <ReadOnlyField label="Total balance across all cards" value={`$${Math.round(trackedDebts.credit_card.balance).toLocaleString()}`} />
                    <ReadOnlyField label="Average interest rate" value={`${trackedDebts.credit_card.rate.toFixed(2)}% APR`} />
                    <ReadOnlyField label="Minimum monthly payment" value={`$${Math.round(trackedDebts.credit_card.payment).toLocaleString()}`} />
                    <TrackedInDebtsNote />
                  </>) : paidOffDebtTypes.has('credit_card') ? (
                    <PaidOffNote />
                  ) : (<>
                    <DollarInput label="Total balance across all cards" value={form.creditCardBalance} onChange={v => set('creditCardBalance', v)} />
                    <SuffixInput label="Average interest rate" suffix="% APR" value={form.creditCardRate} onChange={v => set('creditCardRate', v)} placeholder="22" />
                    <DollarInput label="Minimum monthly payment" value={form.creditCardPayment} onChange={v => set('creditCardPayment', v)} />
                    <DollarInput label="Original balance (if different from current balance)"
                      hint="Optional — used only for the debt tracker's records. Leave blank to use the current balance."
                      value={form.creditCardOriginalBalance} onChange={v => set('creditCardOriginalBalance', v)} />
                  </>)}
                </div>
              )}
              {(form.hasBusinessLoan || paidOffDebtTypes.has('business_loan')) && (
                <div className="pl-4 border-l-2 border-gray-100 space-y-3">
                  <Divider label="Business Loan" />
                  {trackedDebts.business_loan ? (<>
                    <ReadOnlyField label="Balance" value={`$${Math.round(trackedDebts.business_loan.balance).toLocaleString()}`} />
                    <ReadOnlyField label="Interest rate" value={`${trackedDebts.business_loan.rate.toFixed(2)}% APR`} />
                    <ReadOnlyField label="Minimum monthly payment" value={`$${Math.round(trackedDebts.business_loan.payment).toLocaleString()}`} />
                    <TrackedInDebtsNote />
                  </>) : paidOffDebtTypes.has('business_loan') ? (
                    <PaidOffNote />
                  ) : (<>
                    <DollarInput label="Balance" value={form.businessLoanBalance} onChange={v => set('businessLoanBalance', v)} />
                    <SuffixInput label="Interest rate" suffix="% APR" value={form.businessLoanRate} onChange={v => set('businessLoanRate', v)} placeholder="7.0" />
                    <DollarInput label="Minimum monthly payment" value={form.businessLoanPayment} onChange={v => set('businessLoanPayment', v)} />
                    <DollarInput label="Original loan amount (if different from current balance)"
                      hint="Optional — used only for the debt tracker's records. Leave blank to use the current balance."
                      value={form.businessLoanOriginalBalance} onChange={v => set('businessLoanOriginalBalance', v)} />
                  </>)}
                </div>
              )}
              {(form.hasOtherDebt || paidOffDebtTypes.has('other')) && (
                <div className="pl-4 border-l-2 border-teal-100 space-y-3">
                  <Divider label="Other Debt" />
                  {paidOffDebtTypes.has('other') ? (
                    <PaidOffNote />
                  ) : (<>
                    <TextInput label="What is this debt for?"
                      hint="E.g. home improvement, medical, pool loan — anything that doesn't fit the categories above."
                      placeholder="Home improvement loan" value={form.otherDebtLabel} onChange={v => set('otherDebtLabel', v)} />
                    {trackedDebts.other ? (<>
                      <ReadOnlyField label="Balance" value={`$${Math.round(trackedDebts.other.balance).toLocaleString()}`} />
                      <ReadOnlyField label="Interest rate" value={`${trackedDebts.other.rate.toFixed(2)}% APR`} />
                      <ReadOnlyField label="Minimum monthly payment" value={`$${Math.round(trackedDebts.other.payment).toLocaleString()}`} />
                      <TrackedInDebtsNote />
                    </>) : (<>
                      <DollarInput label="Balance" value={form.otherDebtBalance} onChange={v => set('otherDebtBalance', v)} />
                      <SuffixInput label="Interest rate" suffix="% APR" value={form.otherDebtRate} onChange={v => set('otherDebtRate', v)} placeholder="8.0" />
                      <DollarInput label="Minimum monthly payment" value={form.otherDebtPayment} onChange={v => set('otherDebtPayment', v)} />
                      <DollarInput label="Original loan amount (if different from current balance)"
                        hint="Optional — used only for the debt tracker's records. Leave blank to use the current balance."
                        value={form.otherDebtOriginalBalance} onChange={v => set('otherDebtOriginalBalance', v)} />
                    </>)}
                  </>)}
                </div>
              )}
            </>)}

            {/* ── Section 5: Cash Flow ──────────────────────────────── */}
            {section === 5 && (<>
              <DollarInput label="Monthly essential expenses"
                hint="Housing, food, transportation, utilities, insurance — non-negotiable spend."
                value={form.essentialMonthlySpend} onChange={v => set('essentialMonthlySpend', v)} />

              <DollarInput label="Monthly discretionary spending"
                hint="Dining out, entertainment, subscriptions, shopping, travel."
                value={form.discretionaryMonthlySpend} onChange={v => set('discretionaryMonthlySpend', v)} />

              {(n(form.essentialMonthlySpend) > 0 || n(form.discretionaryMonthlySpend) > 0) && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 space-y-0">
                  <StatRow label="Essential" value={`$${n(form.essentialMonthlySpend).toLocaleString()}`} />
                  <StatRow label="Discretionary" value={`$${n(form.discretionaryMonthlySpend).toLocaleString()}`} />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-700">Total monthly spend</span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">${totalMonthly.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <DollarInput label="Emergency fund / liquid savings"
                hint="Cash in checking, savings, or money market accounts."
                value={form.emergencyFund} onChange={v => set('emergencyFund', v)} />

              <DollarInput label="Extra payments toward debt beyond minimums (typical monthly amount)"
                hint="Anything you regularly pay above the minimums listed in Liabilities — separate from discretionary spending."
                value={form.extraDebtPayments} onChange={v => set('extraDebtPayments', v)} />

              <DollarInput label="Monthly child support paid"
                hint="A court-ordered or agreed monthly payment. Not tax-deductible."
                value={form.childSupportMonthly} onChange={v => set('childSupportMonthly', v)} />

              <DollarInput label="Monthly alimony/spousal support paid"
                hint="For agreements executed after Dec 31, 2018, this is not tax-deductible and not taxable to the recipient. If your agreement predates 2019 and hasn't been modified, the old rules may still apply — consult your CPA."
                value={form.alimonyMonthly} onChange={v => set('alimonyMonthly', v)} />
            </>)}

            {/* ── Section 6: Household ──────────────────────────────── */}
            {section === 6 && (<>
              <SuffixInput label="Number of dependents under 18" suffix="kids"
                value={form.dependentsUnder18} onChange={v => set('dependentsUnder18', v)} placeholder="0" />

              <TextInput label="Ages of dependents"
                hint="Comma-separated — e.g. 12, 15. Helps with the hire-your-kids strategy."
                placeholder="12, 15" value={form.dependentAges} onChange={v => set('dependentAges', v)} />

              {form.spouseWorks && (
                <SuffixInput label="Total hours your spouse works per week"
                  hint="Employment + business combined. Used for REPS eligibility calculation."
                  suffix="hrs/wk" value={form.spouseHoursPerWeekInBusiness}
                  onChange={v => set('spouseHoursPerWeekInBusiness', v)} placeholder="40" />
              )}
            </>)}

            {/* Shared error banner — rendered for whichever section the error applies to
                (e.g. Section 1's bonus-amount validation, or a final-submit failure). */}
            {saveError && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-red-700">{saveError}</p>
              </div>
            )}

            {/* Non-blocking sync warning — the snapshot itself saved fine, but one of the
                background syncs (debt tracker / financial phase / deployable capital)
                failed, so shown as a distinct amber warning rather than the red save-error.
                The auto-redirect to snapshot-summary is skipped when this is showing (see
                handleSubmit), so the user isn't auto-advanced past a warning they haven't
                read — they can retry the save, or continue on manually via the link below. */}
            {syncWarning && (
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-amber-700">
                  <p>Your snapshot saved, but some background updates (debt tracking / financial phase / deployable capital) didn&apos;t complete — try saving again in a moment.</p>
                  <button type="button"
                    onClick={() => router.push('/dashboard/audit/snapshot-summary' + (freshParam ? '?fresh=true' : ''))}
                    className="mt-1.5 font-semibold underline hover:no-underline">
                    Continue to summary anyway →
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Navigation */}
          <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
            <button type="button" disabled={section === 1} onClick={() => setSection(s => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex gap-1">
              {SECTIONS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i + 1 === section ? 'w-4 bg-[#1B3A2D]' : i + 1 < section ? 'w-1.5 bg-emerald-400' : 'w-1.5 bg-gray-200'}`} />
              ))}
            </div>

            {isLast ? (
              <button type="button" onClick={handleSubmit} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#1B3A2D] text-white text-xs font-semibold hover:bg-[#24503d] disabled:opacity-60 transition">
                {saving ? (<><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>) : <>Complete Phase 1 →</>}
              </button>
            ) : (
              <button type="button" onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition">
                Next
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Your data is saved privately to your account and never shared.
        </p>
      </main>
    </div>
  );
}

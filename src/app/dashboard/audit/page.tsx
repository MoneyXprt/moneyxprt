'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { saveSnapshot, getLatestSnapshot } from '@/app/lib/snapshots';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';
import type { Session } from '@supabase/supabase-js';

// ─── Form state ───────────────────────────────────────────────────────────────

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
  // S5 — Cash Flow
  essentialMonthlySpend: string; discretionaryMonthlySpend: string; emergencyFund: string;
  extraDebtPayments: string;
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
  essentialMonthlySpend: '', discretionaryMonthlySpend: '', emergencyFund: '',
  extraDebtPayments: '',
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
    // No backing FinancialSnapshot field for these minimum-payment amounts yet — added
    // to the form ahead of the type/migration update (next step). Left blank on reload
    // until that lands.
    studentLoanPayment: '',
    personalLoanBalance: String(s.personalLoanBalance || ''),
    personalLoanRate:    String(s.personalLoanRate || ''),
    personalLoanPayment: '',
    creditCardBalance:   String(s.creditCardBalance || ''),
    creditCardRate:      String(s.creditCardRate || ''),
    creditCardPayment:   '',
    businessLoanBalance: String(s.businessLoanBalance || ''),
    businessLoanRate:    String(s.businessLoanRate || ''),
    businessLoanPayment: '',
    // "Other" debt has no backing FinancialSnapshot field yet either (next step).
    hasOtherDebt: false,
    otherDebtLabel: '', otherDebtBalance: '', otherDebtRate: '', otherDebtPayment: '',
    essentialMonthlySpend:      rnd(s.essentialMonthlySpend, 500),
    discretionaryMonthlySpend:  rnd(s.discretionaryMonthlySpend, 100),
    emergencyFund:              rnd(s.emergencyFund, 1000),
    // No backing FinancialSnapshot field yet (next step).
    extraDebtPayments: '',
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
    setSaving(true); setSaveError(null);
    try {
      const essential     = n(form.essentialMonthlySpend);
      const discretionary = n(form.discretionaryMonthlySpend);
      const grossBonus    = n(form.bonusIncome);
      const bonusDeferred = form.bonusDefers ? Math.min(n(form.bonusDeferred), grossBonus) : 0;

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
        hasBusinessEntity:              form.hasBusinessEntity,
        businessRevenue:                form.hasBusinessEntity ? n(form.businessRevenue) : 0,
        primaryBusinessNetProfit:       form.hasBusinessEntity ? n(form.primaryBusinessNetProfit) : 0,
        primaryBusinessType:            form.hasBusinessEntity ? form.primaryBusinessType : '',
        primaryHoursPerWeekInBusiness:  form.hasBusinessEntity ? n(form.primaryHoursPerWeekInBusiness) : 0,
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

      router.push('/dashboard/audit/snapshot-summary' + (freshParam ? '?fresh=true' : ''));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
      setSaving(false);
    }
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

              {!form.hasCarLoan && !form.hasStudentLoan && !form.hasPersonalLoan && !form.hasCreditCard && !form.hasBusinessLoan && !form.hasOtherDebt && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                  <p className="text-xs text-emerald-700 font-medium">No debt selected — tap any that apply above, or continue to the next section.</p>
                </div>
              )}

              {form.hasCarLoan && (
                <div className="pl-4 border-l-2 border-blue-100 space-y-3">
                  <Divider label="Car Loan" />
                  <DollarInput label="Balance" value={form.carLoanBalance} onChange={v => set('carLoanBalance', v)} />
                  <SuffixInput label="Interest rate" suffix="% APR" value={form.carLoanRate} onChange={v => set('carLoanRate', v)} placeholder="6.5" />
                  <DollarInput label="Minimum monthly payment" value={form.carLoanPayment} onChange={v => set('carLoanPayment', v)} />
                </div>
              )}
              {form.hasStudentLoan && (
                <div className="pl-4 border-l-2 border-purple-100 space-y-3">
                  <Divider label="Student Loans" />
                  <DollarInput label="Total balance" value={form.studentLoanBalance} onChange={v => set('studentLoanBalance', v)} />
                  <SuffixInput label="Average interest rate" suffix="% APR" value={form.studentLoanRate} onChange={v => set('studentLoanRate', v)} placeholder="6.0" />
                  <DollarInput label="Minimum monthly payment" value={form.studentLoanPayment} onChange={v => set('studentLoanPayment', v)} />
                </div>
              )}
              {form.hasPersonalLoan && (
                <div className="pl-4 border-l-2 border-orange-100 space-y-3">
                  <Divider label="Personal Loan" />
                  <DollarInput label="Balance" value={form.personalLoanBalance} onChange={v => set('personalLoanBalance', v)} />
                  <SuffixInput label="Interest rate" suffix="% APR" value={form.personalLoanRate} onChange={v => set('personalLoanRate', v)} placeholder="9.0" />
                  <DollarInput label="Minimum monthly payment" value={form.personalLoanPayment} onChange={v => set('personalLoanPayment', v)} />
                </div>
              )}
              {form.hasCreditCard && (
                <div className="pl-4 border-l-2 border-red-100 space-y-3">
                  <Divider label="Credit Card Debt" />
                  <DollarInput label="Total balance across all cards" value={form.creditCardBalance} onChange={v => set('creditCardBalance', v)} />
                  <SuffixInput label="Average interest rate" suffix="% APR" value={form.creditCardRate} onChange={v => set('creditCardRate', v)} placeholder="22" />
                  <DollarInput label="Minimum monthly payment" value={form.creditCardPayment} onChange={v => set('creditCardPayment', v)} />
                </div>
              )}
              {form.hasBusinessLoan && (
                <div className="pl-4 border-l-2 border-gray-100 space-y-3">
                  <Divider label="Business Loan" />
                  <DollarInput label="Balance" value={form.businessLoanBalance} onChange={v => set('businessLoanBalance', v)} />
                  <SuffixInput label="Interest rate" suffix="% APR" value={form.businessLoanRate} onChange={v => set('businessLoanRate', v)} placeholder="7.0" />
                  <DollarInput label="Minimum monthly payment" value={form.businessLoanPayment} onChange={v => set('businessLoanPayment', v)} />
                </div>
              )}
              {form.hasOtherDebt && (
                <div className="pl-4 border-l-2 border-teal-100 space-y-3">
                  <Divider label="Other Debt" />
                  <TextInput label="What is this debt for?"
                    hint="E.g. home improvement, medical, pool loan — anything that doesn't fit the categories above."
                    placeholder="Home improvement loan" value={form.otherDebtLabel} onChange={v => set('otherDebtLabel', v)} />
                  <DollarInput label="Balance" value={form.otherDebtBalance} onChange={v => set('otherDebtBalance', v)} />
                  <SuffixInput label="Interest rate" suffix="% APR" value={form.otherDebtRate} onChange={v => set('otherDebtRate', v)} placeholder="8.0" />
                  <DollarInput label="Minimum monthly payment" value={form.otherDebtPayment} onChange={v => set('otherDebtPayment', v)} />
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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { saveSnapshot, getLatestSnapshot } from '@/app/lib/snapshots';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';
import type { Session } from '@supabase/supabase-js';

// ─── Form state shape ─────────────────────────────────────────────────────────
// All numeric fields are kept as strings so inputs can be empty without
// becoming NaN. Parsed to numbers only on final submit.

interface FormState {
  // Step 1 — Income
  w2Income:           string;
  bonusIncome:        string;   // gross total
  bonusDefers:        boolean;  // UI toggle: does any of this get deferred?
  bonusDeferred:      string;   // amount deferred (user input)
  income1099:         string;
  spouseWorks:        boolean;
  // Step 1 — Spouse income details (shown when spouseWorks = true)
  spouseIncomeType:              'w2' | 'self_employment' | 'both' | '';
  spouseW2Income:                string;
  spouseBusinessRevenue:         string;
  spouseBusinessNetProfit:       string;
  spouseHoursPerWeekInBusiness:  string;
  spouseState:                   string;
  // Step 2 — Household
  filingStatus:       'single' | 'mfj';
  state:              string;
  dependentsUnder18:  string;
  hasBusinessEntity:  boolean;
  businessRevenue:    string;
  // Step 2 — Primary business details
  primaryBusinessNetProfit:       string;
  primaryBusinessType:            string;
  primaryHoursPerWeekInBusiness:  string;
  // Step 2 — Spouse business entity (shown when hasBusinessEntity && spouseWorks)
  spouseHasSeparateBusiness:  boolean;
  spouseBusinessType:         string;
  // Step 3 — Financial Position
  currentTaxPaid:        string;
  monthlySpend:          string;
  emergencyFund:         string;
  retirementBalance:     string;
  homeEquity:            string;
  traditionalIraBalance: string;
  monthlyRentalIncome:   string;
  monthlyDividendIncome: string;
  hasHsaAvailable:       boolean;
  // Step 4 — Real Estate & Goals
  consideringRealEstate:          boolean;
  plannedPropertyValue:           string;
  repsQualified:                  boolean | undefined;
  employer401kAllowsAfterTax:     boolean | undefined;
}

const EMPTY_FORM: FormState = {
  w2Income: '', bonusIncome: '', bonusDefers: false, bonusDeferred: '', income1099: '', spouseWorks: false,
  spouseIncomeType: '', spouseW2Income: '', spouseBusinessRevenue: '', spouseBusinessNetProfit: '',
  spouseHoursPerWeekInBusiness: '', spouseState: 'CA',
  filingStatus: 'mfj', state: 'CA',
  dependentsUnder18: '', hasBusinessEntity: false, businessRevenue: '',
  primaryBusinessNetProfit: '', primaryBusinessType: '', primaryHoursPerWeekInBusiness: '',
  spouseHasSeparateBusiness: false, spouseBusinessType: '',
  currentTaxPaid: '', monthlySpend: '', emergencyFund: '',
  retirementBalance: '', homeEquity: '', traditionalIraBalance: '',
  monthlyRentalIncome: '', monthlyDividendIncome: '',
  hasHsaAvailable: false,
  consideringRealEstate: false, plannedPropertyValue: '',
  repsQualified: undefined, employer401kAllowsAfterTax: undefined,
};

function snapshotToForm(s: FinancialSnapshot): FormState {
  return {
    w2Income:           String(s.w2Income || ''),
    bonusIncome:        String(s.bonusIncome || ''),
    bonusDefers:        s.bonusDeferred > 0,
    bonusDeferred:      String(s.bonusDeferred || ''),
    income1099:         String(s.income1099 || ''),
    spouseWorks:        s.spouseWorks,
    spouseIncomeType:             s.spouseW2Income > 0 && s.spouseBusinessRevenue > 0 ? 'both'
                                : s.spouseW2Income > 0 ? 'w2'
                                : s.spouseBusinessRevenue > 0 ? 'self_employment' : '',
    spouseW2Income:               String(s.spouseW2Income || ''),
    spouseBusinessRevenue:        String(s.spouseBusinessRevenue || ''),
    spouseBusinessNetProfit:      String(s.spouseBusinessNetProfit || ''),
    spouseHoursPerWeekInBusiness: String(s.spouseHoursPerWeekInBusiness || ''),
    spouseState:                  s.state,
    filingStatus:       s.filingStatus,
    state:              s.state,
    dependentsUnder18:  String(s.dependentsUnder18 || ''),
    hasBusinessEntity:  s.hasBusinessEntity,
    businessRevenue:    String(s.businessRevenue || ''),
    primaryBusinessNetProfit:      String(s.primaryBusinessNetProfit || ''),
    primaryBusinessType:           s.primaryBusinessType || '',
    primaryHoursPerWeekInBusiness: String(s.primaryHoursPerWeekInBusiness || ''),
    spouseHasSeparateBusiness:     s.spouseBusinessType !== '',
    spouseBusinessType:            s.spouseBusinessType || '',
    currentTaxPaid:        String(s.currentTaxPaid || ''),
    monthlySpend:          String(s.monthlySpend || ''),
    emergencyFund:         String(s.emergencyFund || ''),
    retirementBalance:     String(s.retirementBalance || ''),
    homeEquity:            String(s.homeEquity || ''),
    traditionalIraBalance: String(s.traditionalIraBalance || ''),
    monthlyRentalIncome:   String(s.monthlyRentalIncome || ''),
    monthlyDividendIncome: String(s.monthlyDividendIncome || ''),
    hasHsaAvailable:       s.hasHsaAvailable,
    consideringRealEstate: s.consideringRealEstate,
    plannedPropertyValue: String(s.plannedPropertyValue || ''),
    repsQualified:      s.repsQualified,
    employer401kAllowsAfterTax: s.employer401kAllowsAfterTax,
  };
}

const n = (v: string) => (v === '' ? 0 : parseFloat(v) || 0);

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Income' },
  { label: 'Household' },
  { label: 'Financial Position' },
  { label: 'Real Estate & Goals' },
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

// ─── Reusable sub-components ──────────────────────────────────────────────────

function DollarInput({
  label, hint, value, onChange, placeholder = '0',
}: {
  label: string; hint?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">$</span>
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        />
      </div>
    </div>
  );
}

function Toggle({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 text-sm">
        {([true, false] as const).map(opt => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-5 py-2 text-xs font-medium transition ${
              value === opt
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {opt ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreeWayToggle({
  label, hint, value, onChange,
}: {
  label: string; hint?: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  const opts: { label: string; value: boolean | undefined }[] = [
    { label: 'Yes',      value: true },
    { label: 'No',       value: false },
    { label: 'Not sure', value: undefined },
  ];
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <div className="inline-flex rounded-xl overflow-hidden border border-gray-200">
        {opts.map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 text-xs font-medium transition ${
              value === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Auth gate (same pattern as logs page) ────────────────────────────────────

function AuthGate({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const sb = getBrowserSupabaseClient();
    const { error: err } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard/audit` },
    });
    setLoading(false);
    if (err) { setError(err.message); } else { setSent(true); }
  };

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, session) => {
      if (session) onSession(session);
    });
    return () => subscription.unsubscribe();
  }, [onSession]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 mb-4">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Sign in to continue</h1>
        <p className="mt-1 text-sm text-gray-500 mb-6">We&apos;ll send a one-click sign-in link.</p>
        {sent ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4 text-sm text-emerald-700">
            <p className="font-medium">Check your email</p>
            <p className="mt-0.5 text-emerald-600">Magic link sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <input type="email" required placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" />
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
              {loading ? 'Sending…' : 'Send magic link'}
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
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Session + pre-populate from latest snapshot ──────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) {
        try {
          const latest = await getLatestSnapshot();
          if (latest) setForm(snapshotToForm(latest));
        } catch { /* first time — no snapshot yet */ }
      }
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // ── Final submit ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const grossBonus      = n(form.bonusIncome);
      const bonusDeferred   = form.bonusDefers ? Math.min(n(form.bonusDeferred), grossBonus) : 0;
      const bonusTakenAsCash = grossBonus - bonusDeferred;

      const snapshot: FinancialSnapshot = {
        w2Income:            n(form.w2Income),
        bonusIncome:         grossBonus,
        bonusDeferred,
        bonusTakenAsCash,
        income1099:          n(form.income1099),
        spouseWorks:         form.spouseWorks,
        filingStatus:        form.filingStatus,
        state:               form.state,
        dependentsUnder18:   n(form.dependentsUnder18),
        hasBusinessEntity:              form.hasBusinessEntity,
        businessRevenue:               form.hasBusinessEntity ? n(form.businessRevenue) : 0,
        primaryBusinessNetProfit:      form.hasBusinessEntity ? n(form.primaryBusinessNetProfit) : 0,
        primaryBusinessType:           form.hasBusinessEntity ? form.primaryBusinessType : '',
        primaryHoursPerWeekInBusiness: form.hasBusinessEntity ? n(form.primaryHoursPerWeekInBusiness) : 0,
        spouseW2Income:                form.spouseWorks && (form.spouseIncomeType === 'w2' || form.spouseIncomeType === 'both')
                                         ? n(form.spouseW2Income) : 0,
        spouseBusinessRevenue:         form.spouseWorks && (form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both')
                                         ? n(form.spouseBusinessRevenue) : 0,
        spouseBusinessNetProfit:       form.spouseWorks && (form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both')
                                         ? n(form.spouseBusinessNetProfit) : 0,
        spouseBusinessType:            form.spouseWorks && form.spouseHasSeparateBusiness
                                         ? form.spouseBusinessType : '',
        spouseHoursPerWeekInBusiness:  form.spouseWorks
                                         ? n(form.spouseHoursPerWeekInBusiness) : 0,
        currentTaxPaid:      n(form.currentTaxPaid),
        monthlySpend:        n(form.monthlySpend),
        emergencyFund:       n(form.emergencyFund),
        retirementBalance:   n(form.retirementBalance),
        homeEquity:            n(form.homeEquity),
        traditionalIraBalance: n(form.traditionalIraBalance),
        monthlyRentalIncome:   n(form.monthlyRentalIncome),
        monthlyDividendIncome: n(form.monthlyDividendIncome),
        hasHsaAvailable:       form.hasHsaAvailable,
        consideringRealEstate: form.consideringRealEstate,
        plannedPropertyValue:  form.consideringRealEstate && form.plannedPropertyValue
          ? n(form.plannedPropertyValue) : undefined,
        repsQualified:       form.consideringRealEstate ? form.repsQualified : undefined,
        employer401kAllowsAfterTax: form.employer401kAllowsAfterTax,
        debts: [],
      };
      await saveSnapshot(snapshot);
      router.push('/dashboard/asset-preferences');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
      setSaving(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  // ── Step content ──────────────────────────────────────────────────────────
  const isLastStep = step === STEPS.length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300 text-sm">/</span>
            <span className="text-sm text-gray-500">Tax Audit</span>
          </div>
          <span className="text-xs text-gray-400">{session.user.email}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Progress indicator ───────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-600">
              Step {step} of {STEPS.length} — {STEPS[step - 1].label}
            </span>
            <span className="text-xs text-gray-400">{Math.round((step / STEPS.length) * 100)}% complete</span>
          </div>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s.label}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < step ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Form card ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-gray-50">
            <h1 className="text-lg font-semibold text-gray-900">{STEPS[step - 1].label}</h1>
            <p className="mt-0.5 text-xs text-gray-400">
              {step === 1 && 'Tell us about your income sources this year.'}
              {step === 2 && 'Help us understand your household and business situation.'}
              {step === 3 && 'Your current financial position helps us size the opportunity.'}
              {step === 4 && 'A few final questions about real estate and your retirement plan.'}
            </p>
          </div>

          <div className="px-6 py-6 space-y-5">

            {/* ── Step 1: Income ─────────────────────────────────────── */}
            {step === 1 && (
              <>
                <DollarInput label="W-2 base salary"
                  hint="Your gross annual salary before taxes or deductions."
                  value={form.w2Income} onChange={v => set('w2Income', v)} />

                {/* Bonus section with deferred comp split */}
                <DollarInput label="Gross bonus / profit share"
                  hint="Total expected bonus, commission, or profit-sharing before any deferral."
                  value={form.bonusIncome}
                  onChange={v => {
                    set('bonusIncome', v);
                    // Clamp deferred if it now exceeds new gross
                    if (n(form.bonusDeferred) > n(v)) set('bonusDeferred', v);
                  }} />

                {n(form.bonusIncome) > 0 && (
                  <div className="pl-4 border-l-2 border-indigo-100 space-y-4">
                    <Toggle
                      label="Do you defer any of this?"
                      hint="Elective or mandatory deferred compensation you won't receive as cash this year."
                      value={form.bonusDefers}
                      onChange={v => { set('bonusDefers', v); if (!v) set('bonusDeferred', ''); }}
                    />
                    {form.bonusDefers && (
                      <>
                        <DollarInput
                          label="Amount deferred (not taxable this year)"
                          hint="Deferred comp, mandatory or elective, that you won't receive as cash this year."
                          value={form.bonusDeferred}
                          onChange={v => {
                            const capped = Math.min(n(v), n(form.bonusIncome));
                            set('bonusDeferred', capped === n(v) ? v : String(capped));
                          }}
                        />
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-2.5">
                          <span className="text-xs text-gray-500">Taken as cash this year</span>
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
                            ${Math.max(0, n(form.bonusIncome) - n(form.bonusDeferred)).toLocaleString()}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <DollarInput label="1099 / side income"
                  hint="Freelance, consulting, or any self-employment income."
                  value={form.income1099} onChange={v => set('income1099', v)} />
                <Toggle label="Does your spouse work?"
                  hint="Includes full-time, part-time, or self-employment income."
                  value={form.spouseWorks} onChange={v => {
                    set('spouseWorks', v);
                    if (!v) { set('spouseIncomeType', ''); set('spouseW2Income', ''); set('spouseBusinessRevenue', ''); set('spouseBusinessNetProfit', ''); set('spouseHoursPerWeekInBusiness', ''); }
                  }} />

                {form.spouseWorks && (
                  <div className="pl-4 border-l-2 border-indigo-100 space-y-4">
                    <p className="text-xs font-semibold text-gray-600">Spouse Income</p>

                    {/* Income type radio */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Spouse income type</label>
                      <div className="flex flex-col gap-2">
                        {([
                          { value: 'w2',              label: 'W-2 Employment' },
                          { value: 'self_employment',  label: 'Self-Employment or Business' },
                          { value: 'both',             label: 'Both' },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button"
                            onClick={() => set('spouseIncomeType', opt.value)}
                            className={`flex items-center gap-2.5 text-left px-3.5 py-2.5 rounded-xl border text-xs transition ${
                              form.spouseIncomeType === opt.value
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              form.spouseIncomeType === opt.value ? 'border-indigo-500' : 'border-gray-300'
                            }`}>
                              {form.spouseIncomeType === opt.value && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                            </div>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* W2 income */}
                    {(form.spouseIncomeType === 'w2' || form.spouseIncomeType === 'both') && (
                      <DollarInput label="Spouse W-2 income"
                        hint="Gross annual salary before taxes."
                        value={form.spouseW2Income} onChange={v => set('spouseW2Income', v)} />
                    )}

                    {/* Self-employment details */}
                    {(form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both') && (
                      <>
                        <DollarInput label="Spouse business gross revenue"
                          hint="Total revenue before expenses."
                          value={form.spouseBusinessRevenue} onChange={v => set('spouseBusinessRevenue', v)} />
                        <DollarInput label="Spouse business net profit"
                          hint="After expenses — this is what gets taxed."
                          value={form.spouseBusinessNetProfit} onChange={v => set('spouseBusinessNetProfit', v)} />
                      </>
                    )}

                    {/* Hours per week — always shown when spouse works */}
                    <DollarInput label="Spouse hours per week in business / work"
                      hint="Important for REPS eligibility calculation — total non-real-estate working hours."
                      value={form.spouseHoursPerWeekInBusiness} onChange={v => set('spouseHoursPerWeekInBusiness', v)}
                      placeholder="40" />

                    {/* Spouse state */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Spouse state (if different)</label>
                      <select value={form.spouseState} onChange={e => set('spouseState', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                        {US_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Step 2: Household ──────────────────────────────────── */}
            {step === 2 && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Filing status</label>
                  <select value={form.filingStatus} onChange={e => set('filingStatus', e.target.value as 'single' | 'mfj')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                    <option value="mfj">Married filing jointly</option>
                    <option value="single">Single</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">State of residence</label>
                  <select value={form.state} onChange={e => set('state', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                    {US_STATES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <DollarInput label="Number of dependents under 18"
                  hint="Children or other dependents you claim."
                  value={form.dependentsUnder18} onChange={v => set('dependentsUnder18', v)}
                  placeholder="0" />
                <Toggle label="Do you or your spouse own a business or LLC?"
                  hint="Includes sole proprietorships, single-member LLCs, S-Corps, or partnerships."
                  value={form.hasBusinessEntity} onChange={v => set('hasBusinessEntity', v)} />
                {form.hasBusinessEntity && (
                  <div className="pl-4 border-l-2 border-indigo-100 space-y-4">
                    <p className="text-xs font-semibold text-gray-600 pt-1">Your Business</p>
                    <DollarInput label="Business gross revenue"
                      hint="Total revenue before expenses."
                      value={form.businessRevenue} onChange={v => set('businessRevenue', v)} />
                    <DollarInput label="Business net profit"
                      hint="After expenses — this is what gets taxed."
                      value={form.primaryBusinessNetProfit} onChange={v => set('primaryBusinessNetProfit', v)} />
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Business type</label>
                      <select value={form.primaryBusinessType} onChange={e => set('primaryBusinessType', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                        <option value="">Select type…</option>
                        <option value="sole_prop">Sole Proprietorship</option>
                        <option value="smllc">Single-Member LLC</option>
                        <option value="scorp">S-Corp</option>
                        <option value="partnership">Partnership</option>
                      </select>
                    </div>
                    <DollarInput label="Hours per week you spend on this business"
                      hint="Used to size your Solo 401k and S-Corp election strategies."
                      value={form.primaryHoursPerWeekInBusiness} onChange={v => set('primaryHoursPerWeekInBusiness', v)}
                      placeholder="10" />

                    {form.spouseWorks && (
                      <>
                        <div className="pt-2 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-600 mb-3">Spouse Business</p>
                          <Toggle label="Does your spouse have a separate business?"
                            value={form.spouseHasSeparateBusiness}
                            onChange={v => { set('spouseHasSeparateBusiness', v); if (!v) set('spouseBusinessType', ''); }} />
                        </div>
                        {form.spouseHasSeparateBusiness && (
                          <div className="space-y-4">
                            <DollarInput label="Spouse business gross revenue"
                              value={form.spouseBusinessRevenue} onChange={v => set('spouseBusinessRevenue', v)} />
                            <DollarInput label="Spouse business net profit"
                              hint="After expenses."
                              value={form.spouseBusinessNetProfit} onChange={v => set('spouseBusinessNetProfit', v)} />
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Spouse business type</label>
                              <select value={form.spouseBusinessType} onChange={e => set('spouseBusinessType', e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition">
                                <option value="">Select type…</option>
                                <option value="sole_prop">Sole Proprietorship</option>
                                <option value="smllc">Single-Member LLC</option>
                                <option value="scorp">S-Corp</option>
                                <option value="partnership">Partnership</option>
                              </select>
                            </div>
                            <DollarInput label="Hours per week spouse spends on this business"
                              hint="Used to calculate REPS eligibility."
                              value={form.spouseHoursPerWeekInBusiness} onChange={v => set('spouseHoursPerWeekInBusiness', v)}
                              placeholder="20" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Step 3: Financial Position ─────────────────────────── */}
            {step === 3 && (
              <>
                <DollarInput label="Estimated total tax paid last year"
                  hint="Federal + state income tax withheld or paid (W-2 box 2 + any estimated payments)."
                  value={form.currentTaxPaid} onChange={v => set('currentTaxPaid', v)} />
                <DollarInput label="Monthly spending"
                  hint="Average total monthly expenses (housing, food, transportation, etc.)."
                  value={form.monthlySpend} onChange={v => set('monthlySpend', v)} />
                <DollarInput label="Emergency fund / liquid savings"
                  hint="Cash in checking, savings, or money market accounts."
                  value={form.emergencyFund} onChange={v => set('emergencyFund', v)} />
                <DollarInput label="Retirement account balance"
                  hint="Combined total across all 401(k), IRA, and other retirement accounts."
                  value={form.retirementBalance} onChange={v => set('retirementBalance', v)} />
                <DollarInput label="Home equity"
                  hint="Estimated current home value minus outstanding mortgage balance."
                  value={form.homeEquity} onChange={v => set('homeEquity', v)} />
                <DollarInput label="Current monthly rental income"
                  hint="Income from any rental properties you currently own. Enter 0 if none."
                  value={form.monthlyRentalIncome} onChange={v => set('monthlyRentalIncome', v)} />
                <DollarInput label="Current monthly dividend / investment income"
                  hint="Regular income from stocks, funds, or other investments. Exclude one-time gains."
                  value={form.monthlyDividendIncome} onChange={v => set('monthlyDividendIncome', v)} />
                <DollarInput label="Existing traditional IRA balance"
                  hint="Pre-tax IRA balance across all accounts (important for backdoor Roth planning)."
                  value={form.traditionalIraBalance} onChange={v => set('traditionalIraBalance', v)} />
                <Toggle label="HSA available through your employer?"
                  hint="Do you have access to a High-Deductible Health Plan (HDHP) with HSA eligibility?"
                  value={form.hasHsaAvailable} onChange={v => set('hasHsaAvailable', v)} />
              </>
            )}

            {/* ── Step 4: Real Estate & Goals ────────────────────────── */}
            {step === 4 && (
              <>
                <Toggle label="Considering buying a rental property?"
                  value={form.consideringRealEstate}
                  onChange={v => { set('consideringRealEstate', v); if (!v) { set('plannedPropertyValue', ''); set('repsQualified', undefined); } }} />
                {form.consideringRealEstate && (
                  <div className="pl-4 border-l-2 border-indigo-100 space-y-5">
                    <DollarInput label="Planned property purchase price"
                      hint="Your target acquisition price."
                      value={form.plannedPropertyValue}
                      onChange={v => set('plannedPropertyValue', v)} />
                    <Toggle
                      label="Would your non-working spouse manage the property?"
                      hint="Answering yes means they could qualify as a Real Estate Professional (REPS), unlocking depreciation against your W-2 income."
                      value={form.repsQualified ?? false}
                      onChange={v => set('repsQualified', v)} />
                  </div>
                )}
                <ThreeWayToggle
                  label="Does your employer 401(k) allow after-tax contributions?"
                  hint={'Enables the "mega backdoor Roth" strategy. Check with your plan administrator if unsure.'}
                  value={form.employer401kAllowsAfterTax}
                  onChange={v => set('employer401kAllowsAfterTax', v)} />

                {saveError && (
                  <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                    <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-red-700">{saveError}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Navigation ───────────────────────────────────────────── */}
          <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i + 1 === step ? 'bg-indigo-600 w-4' : i + 1 < step ? 'bg-indigo-300' : 'bg-gray-200'}`} />
              ))}
            </div>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    Run my audit
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition"
              >
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

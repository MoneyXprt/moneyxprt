'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { evaluateAll } from '@/app/lib/strategies';
import type { StrategyResult } from '@/app/lib/strategies';
import type { Session } from '@supabase/supabase-js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

// ─── Strategy deep dive content ───────────────────────────────────────────────

interface DeepDive {
  whatItIs: string;
  whatYouNeed: string[];
  commonMistake: string;
  yourNumbers: (r: StrategyResult) => string;
}

const DEEP_DIVES: Partial<Record<string, DeepDive>> = {
  'augusta-rule': {
    whatItIs: 'The IRC §280A(g) exclusion lets homeowners rent their residence to their business for up to 14 days/year without reporting the income. The business deducts the expense; you receive it tax-free.',
    whatYouNeed: ['Written rental agreement between you and your business', 'Fair market rate documentation (comparable venue quotes)', 'Written agenda with attendees and business purpose', 'Records kept for 7 years'],
    commonMistake: 'Not documenting the business purpose. The IRS requires a legitimate business meeting, not just a payment.',
    yourNumbers: (r) => {
      const taxFree = Math.round(r.estimatedAnnualValue / 0.33);
      return `${fmt(taxFree)}/yr tax-free (${fmt(Math.round(taxFree / 14))}/day × 14 days). At a 33% rate, that's ${fmt(r.estimatedAnnualValue)}/yr kept instead of taxed.`;
    },
  },
  'depreciation': {
    whatItIs: 'IRC §168 lets you deduct a rental property\'s building cost (not land) over 27.5 years. With REPS, these paper losses offset your W-2 income dollar for dollar.',
    whatYouNeed: ['A rental property', 'Spouse logging 750+ real estate hours/year (more than any other profession)', 'Contemporaneous time logs — not reconstructed at year end', 'Cost segregation study for maximum first-year deductions'],
    commonMistake: 'Reconstructing time logs at year end. The Tax Court consistently rejects retroactively created logs.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in tax savings as rental depreciation losses offset your ordinary income directly.`,
  },
  'solo-k': {
    whatItIs: 'A Solo 401(k) lets self-employed individuals contribute as both employee (up to $23,500 in 2026) and employer (up to 25% of net SE income). Total possible contribution: $70,000+.',
    whatYouNeed: ['Business with net self-employment income', 'An EIN', 'Solo 401(k) account at Fidelity, Vanguard, or Schwab', 'Account opened and funded by December 31'],
    commonMistake: 'Contributing before calculating net SE income. Deduction is capped at actual net earnings after the SE tax deduction.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in tax savings from maximizing Solo 401(k) contributions.`,
  },
  'backdoor-roth': {
    whatItIs: 'High earners above the Roth IRA limit ($236,000 MFJ in 2026) can contribute to a Traditional IRA and immediately convert to Roth. No income limit on conversions.',
    whatYouNeed: ['Traditional IRA with near-zero pre-tax balance (avoid pro-rata taxation)', '$7,000/spouse to contribute ($8,000 if 50+)', 'IRA custodian that allows immediate conversions (Fidelity, Schwab)'],
    commonMistake: 'Having pre-tax IRA balances. Even a small traditional IRA triggers the pro-rata rule and partially taxes your conversion.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in long-term Roth advantage — $14,000/yr compounding tax-free forever.`,
  },
  'hire-kids': {
    whatItIs: 'Pay your children (ages 7–17) for legitimate work in your business. In a sole prop or parent-owned LLC, wages up to the standard deduction ($14,600 in 2026) are tax-free to the child and deductible to you.',
    whatYouNeed: ['Qualifying business structure (sole prop or parent-owned single-member LLC)', 'Legitimate, age-appropriate work at fair market rate', 'Payroll records, time sheets, and annual W-2s per child'],
    commonMistake: 'Paying kids without documented work. The IRS requires actual services at market rate with contemporaneous records.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in combined savings — your deduction plus the income your child receives below their standard deduction.`,
  },
  'accountable-plan': {
    whatItIs: 'A formal accountable plan lets your business reimburse legitimate expenses tax-free. The company deducts the expense; you receive the reimbursement without income tax.',
    whatYouNeed: ['Written accountable plan document', 'Reimbursements for actual business expenses only (home office, phone, vehicle)', 'Expense reports with receipts submitted within 60 days', 'Unspent advances returned within 120 days'],
    commonMistake: 'Mixing personal and business expenses. Every reimbursed item needs a clear, documented business purpose.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in expenses now reimbursed tax-free instead of paid with after-tax dollars.`,
  },
  'qbi': {
    whatItIs: 'Section 199A lets qualifying business owners deduct up to 20% of qualified business income. On $200,000 in QBI, that\'s a $40,000 deduction at the federal level.',
    whatYouNeed: ['QBI from a pass-through entity (S-Corp, LLC, sole prop)', 'Income below phase-out thresholds ($383,900 MFJ in 2026)', 'Business that is not a Specified Service Trade (or income below the SSTB threshold)'],
    commonMistake: 'Assuming you don\'t qualify because you\'re a professional. Many service businesses qualify below the income threshold.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in federal tax savings from the 20% QBI deduction on your business income.`,
  },
  'hsa': {
    whatItIs: 'A Health Savings Account is the only triple-tax-advantaged account: deductible contributions, tax-free growth, tax-free withdrawals for medical expenses.',
    whatYouNeed: ['A High-Deductible Health Plan (HDHP) — min. deductible $1,650 individual / $3,300 family in 2026', 'No disqualifying coverage (Medicare, non-HDHP FSA)', 'HSA account at Fidelity, Lively, or your bank', 'Contributions by April 15 of following year'],
    commonMistake: 'Spending the HSA on current medical costs. The best strategy: pay out-of-pocket now, let HSA investments compound, reimburse yourself tax-free decades later.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in immediate tax savings — plus decades of tax-free investment growth on top.`,
  },
  'mega-backdoor-roth': {
    whatItIs: 'If your 401(k) allows after-tax contributions and in-service conversions, you can contribute up to an additional $43,500/yr (2026) and convert it to Roth.',
    whatYouNeed: ['A 401(k) that explicitly allows after-tax (non-Roth) contributions', 'The plan must also allow in-service withdrawals or in-plan Roth conversions', 'Written confirmation from your plan administrator', 'Convert immediately after contributing to minimize taxable gains'],
    commonMistake: 'Assuming your plan allows this. Most plans do NOT allow in-service withdrawals. Verify with your plan administrator before contributing.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in long-term advantage — up to $43,500 more/year growing tax-free in Roth.`,
  },
  's-corp-election': {
    whatItIs: 'S-Corp election lets you split business income into salary (subject to payroll tax) and distributions (not). On $200,000 profit with a $100,000 salary, you save ~$7,650/yr in SE taxes.',
    whatYouNeed: ['Business with net profit above ~$40,000', 'Form 2553 filed by March 15 for current-year effect', '"Reasonable compensation" salary documented and paid quarterly', 'Quarterly payroll tax filings (Form 941) and annual W-2'],
    commonMistake: 'Setting salary too low. The IRS requires reasonable compensation for the owner\'s services — below-market salaries trigger audits.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in SE tax savings by routing profit above your reasonable salary as S-Corp distributions.`,
  },
  'reps': {
    whatItIs: 'Real Estate Professional Status unlocks rental losses to offset all ordinary income — including W-2. Requires 750+ hours/year in real estate and more time in RE than any other profession.',
    whatYouNeed: ['Spouse (or you) with 750+ qualifying RE hours/year', 'Real estate must be more than 50% of that person\'s total work hours', 'Contemporaneous time logs kept week by week', 'Qualifying activities: acquisition, property management, construction management, leasing'],
    commonMistake: 'Reconstructing time logs at year end. The Tax Court has consistently rejected retroactively created logs.',
    yourNumbers: (r) => `${fmt(r.estimatedAnnualValue)}/yr in tax savings as rental depreciation losses are unlocked to offset your W-2 income directly.`,
  },
};

// ─── Auth gate ────────────────────────────────────────────────────────────────

function AuthGate({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const sb = getBrowserSupabaseClient();
    const { error: err } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard/audit/results` },
    });
    setLoading(false);
    if (err) setError(err.message); else setSent(true);
  };

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, s) => {
      if (s) onSession(s);
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
        <h1 className="text-xl font-semibold text-gray-900">Sign in to see your results</h1>
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

// ─── Strategy cards ───────────────────────────────────────────────────────────

function ActiveCard({ r }: { r: StrategyResult }) {
  const [expanded, setExpanded] = useState(false);
  const dive = DEEP_DIVES[r.id];

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-0.5" />
            <span className="text-sm font-semibold text-gray-900">{r.name}</span>
          </div>
          <span className="text-base font-bold text-emerald-700 tabular-nums shrink-0">
            {fmt(r.estimatedAnnualValue)}<span className="text-xs font-normal text-emerald-600">/yr</span>
          </span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed pl-4 mb-3">{r.reason}</p>
        {r.cautionNote && (
          <div className="ml-4 flex items-start gap-2 rounded-lg bg-red-50 border-2 border-red-200 px-3 py-2.5 mb-3">
            <svg className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.25 3.75h.008v.008h-.008v-.008z" />
            </svg>
            <p className="text-xs text-red-800 leading-relaxed font-bold">
              Caution: {r.cautionNote}
            </p>
          </div>
        )}
        {dive && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="ml-4 flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 transition"
          >
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? 'Close' : 'Learn more'}
          </button>
        )}
      </div>

      {expanded && dive && (
        <div className="border-t border-emerald-100 bg-white px-4 pb-4 pt-3 space-y-4">
          {/* What it is */}
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">What it is</p>
            <p className="text-xs text-gray-700 leading-relaxed">{dive.whatItIs}</p>
          </div>

          {/* What you need */}
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">What you need</p>
            <ul className="space-y-1">
              {dive.whatYouNeed.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Common mistake */}
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Common mistake</p>
            <p className="text-xs text-amber-800 leading-relaxed">{dive.commonMistake}</p>
          </div>

          {/* Your numbers */}
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">Your numbers</p>
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">{dive.yourNumbers(r)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifyCard({ r }: { r: StrategyResult }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-900">{r.name}</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed pl-4 mb-3">{r.reason}</p>
      {r.blockedBy && (
        <div className="ml-4 flex items-start gap-2 rounded-lg bg-amber-100/70 border border-amber-200/60 px-3 py-2.5">
          <svg className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-medium">Action required: </span>{r.blockedBy}
          </p>
        </div>
      )}
    </div>
  );
}

function LockedCard({ r }: { r: StrategyResult }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm font-medium text-gray-500">{r.name}</span>
        </div>
        {r.estimatedAnnualValue > 0 && (
          <span className="text-xs text-gray-400 tabular-nums shrink-0">
            Potential: {fmt(r.estimatedAnnualValue)}/yr
          </span>
        )}
      </div>
      {r.unlockCondition && (
        <p className="text-xs text-gray-500 leading-relaxed pl-5">{r.unlockCondition}</p>
      )}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, badge, badgeColor, children, empty,
}: {
  title: string;
  badge: number;
  badgeColor: string;
  children: React.ReactNode;
  empty?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {badge === 0
          ? <p className="text-xs text-gray-400 py-2 text-center">{empty}</p>
          : children}
      </div>
    </div>
  );
}

// ─── Debt interest cards ──────────────────────────────────────────────────────

interface DebtRow {
  id: string;
  name: string;
  current_balance: number;
  interest_rate: number; // stored as a plain percentage, e.g. 6 = 6.00% APR
}

function DebtCostRow({ debt }: { debt: DebtRow }) {
  const annualCost = debt.current_balance * (debt.interest_rate / 100);
  return (
    <Link
      href="/dashboard/debts"
      className="block rounded-xl border border-red-100 bg-red-50/40 p-4 hover:bg-red-50 transition"
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-900">{debt.name}</span>
        </div>
        <span className="text-base font-bold text-red-700 tabular-nums shrink-0">
          {fmt(annualCost)}<span className="text-xs font-normal text-red-600">/yr</span>
        </span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed pl-4">
        {fmt(debt.current_balance)} balance at {debt.interest_rate.toFixed(2)}% APR
      </p>
    </Link>
  );
}

function DebtCostHero({ totalAnnualInterest, debtCount }: { totalAnnualInterest: number; debtCount: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <p className="text-sm text-gray-400 mb-1.5">Interest costing you this year:</p>
      <p className="text-4xl font-extrabold text-red-600 tabular-nums leading-none">
        {fmt(totalAnnualInterest)}
        <span className="text-lg font-semibold text-gray-500 ml-1.5">
          /year across {debtCount} active debt{debtCount !== 1 ? 's' : ''}
        </span>
      </p>
    </div>
  );
}

// ─── Threat hero (Defend Part 2) ─────────────────────────────────────────────

function ThreatHero({ cashValue, projectedValue, snapshotDate }: { cashValue: number; projectedValue: number; snapshotDate?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <p className="text-sm text-gray-400 mb-1.5">Cash tax savings this year:</p>
      <p className="text-4xl font-extrabold text-[#C9A84C] tabular-nums leading-none">
        {fmt(cashValue)}
        <span className="text-lg font-semibold text-gray-500 ml-1.5">/year in unnecessary taxes</span>
      </p>
      {projectedValue > 0 && (
        <>
          <p className="text-sm text-gray-400 mt-4 mb-1.5">Long-term value from tax-advantaged growth:</p>
          <p className="text-2xl font-extrabold text-emerald-600 tabular-nums leading-none">
            {fmt(projectedValue)}
            <span className="text-base font-semibold text-gray-500 ml-1.5">/year equivalent</span>
          </p>
        </>
      )}
      <p className="mt-3 text-base font-semibold text-emerald-600">Here&apos;s how to keep it.</p>
      {snapshotDate && (
        <p className="mt-1 text-xs text-gray-400">
          Based on your snapshot from {new Date(snapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
        </p>
      )}
    </div>
  );
}

// ─── First-time audit banner (Defend Part 5) ──────────────────────────────────

function FirstAuditBanner({ cashValue, projectedValue, onDismiss }: { cashValue: number; projectedValue: number; onDismiss: () => void }) {
  const tenYear = Math.round(cashValue * 14.78);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-amber-900">Your tax situation in plain language</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-amber-400 hover:text-amber-700 transition text-sm leading-none shrink-0"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
        At your income level, the default path costs you{' '}
        <strong>{fmt(cashValue)}</strong> in avoidable taxes every year (cash tax savings this year). That&apos;s{' '}
        <strong>{fmt(tenYear)}</strong> over 10 years that could have been building assets instead.
        {projectedValue > 0 && (
          <> On top of that, <strong>{fmt(projectedValue)}</strong>/year in long-term value from tax-advantaged growth is available.</>
        )}
        {' '}This audit shows you how to stop it.
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-4">
      {[80, 60, 80, 50, 80].map((w, i) => (
        <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditResultsPage() {
  const [session, setSession]         = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [results, setResults]         = useState<StrategyResult[] | null>(null);
  const [debts, setDebts]             = useState<DebtRow[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | undefined>();
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [hasSnapshot, setHasSnapshot] = useState(true);
  const [firstAuditDismissed, setFirstAuditDismissed] = useState(false);

  useEffect(() => {
    setFirstAuditDismissed(!!localStorage.getItem('first_audit_view_dismissed'));
  }, []);

  function dismissFirstAudit() {
    localStorage.setItem('first_audit_view_dismissed', '1');
    setFirstAuditDismissed(true);
  }

  // ── Session init ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Load snapshot + run engine ───────────────────────────────────────────
  const runAudit = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getLatestSnapshot();
      if (!snapshot) {
        setHasSnapshot(false);
        setLoading(false);
        return;
      }
      // Capture created_at for display via the raw Supabase query
      const sb = getBrowserSupabaseClient();
      const { data: row } = await sb
        .from('financial_snapshots')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row?.created_at) setSnapshotDate(row.created_at as string);

      setResults(evaluateAll(snapshot));

      // Debt interest — fetched fresh every load (never cached/stored), since balances
      // change as debts are paid down.
      const { data: debtRows } = await sb
        .from('debts')
        .select('id, name, current_balance, interest_rate')
        .eq('user_id', userId)
        .eq('is_active', true);
      setDebts((debtRows ?? []) as DebtRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your audit results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) runAudit(session.user.id);
  }, [session, runAudit]);

  // ── Render guards ────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  // ── Derive grouped results ───────────────────────────────────────────────
  const active = results?.filter(r => r.state === 'ACTIVE').sort((a, b) => b.estimatedAnnualValue - a.estimatedAnnualValue) ?? [];
  const verify = results?.filter(r => r.state === 'VERIFY') ?? [];
  const locked = results?.filter(r => r.state === 'LOCKED') ?? [];
  const totalActiveValue    = active.reduce((sum, r) => sum + r.estimatedAnnualValue, 0);
  const totalCashValue      = active.filter(r => r.valueType === 'cash').reduce((sum, r) => sum + r.estimatedAnnualValue, 0);
  const totalProjectedValue = active.filter(r => r.valueType === 'projected').reduce((sum, r) => sum + r.estimatedAnnualValue, 0);

  const debtsRankedByAnnualCost = [...debts].sort(
    (a, b) => (b.current_balance * b.interest_rate) - (a.current_balance * a.interest_rate),
  );
  const totalAnnualInterest = debtsRankedByAnnualCost.reduce(
    (sum, d) => sum + d.current_balance * (d.interest_rate / 100), 0,
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top nav ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Velocity Audit</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[180px]">{session.user.email}</span>
            <button
              onClick={() => getBrowserSupabaseClient().auth.signOut()}
              className="text-xs text-gray-500 hover:text-gray-900 transition px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Page heading ───────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Your Velocity Audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Strategy opportunities identified from your financial snapshot, ranked by annual impact.
          </p>
        </div>

        {/* ── Loading / error / empty states ─────────────────────────── */}
        {loading && <Skeleton />}

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && !hasSnapshot && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-100 mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">No snapshot yet</h2>
            <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
              Complete your financial intake to see your personalised strategy analysis.
            </p>
            <Link
              href="/dashboard/audit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            >
              Take the audit
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {/* ── Results ────────────────────────────────────────────────── */}
        {!loading && !error && results && (
          <>
            {/* First-time audit banner (Defend Part 5) */}
            {!firstAuditDismissed && totalActiveValue > 0 && (
              <FirstAuditBanner cashValue={totalCashValue} projectedValue={totalProjectedValue} onDismiss={dismissFirstAudit} />
            )}

            {/* Threat hero (Defend Part 2) */}
            <ThreatHero cashValue={totalCashValue} projectedValue={totalProjectedValue} snapshotDate={snapshotDate} />

            {/* Debt costing you money — ranked by annual interest cost, fetched fresh
                every load (not cached) since balances change as debts are paid down. */}
            {debtsRankedByAnnualCost.length > 0 && (
              <>
                <DebtCostHero totalAnnualInterest={totalAnnualInterest} debtCount={debtsRankedByAnnualCost.length} />
                <Section
                  title="Debt costing you money"
                  badge={debtsRankedByAnnualCost.length}
                  badgeColor="bg-red-100 text-red-700"
                >
                  {debtsRankedByAnnualCost.map(d => <DebtCostRow key={d.id} debt={d} />)}
                </Section>
              </>
            )}

            {/* Available Now */}
            <Section
              title="Available Now"
              badge={active.length}
              badgeColor="bg-emerald-100 text-emerald-700"
              empty="No strategies currently active — update your numbers to see opportunities."
            >
              {active.map(r => <ActiveCard key={r.id} r={r} />)}
            </Section>

            {/* Verify These */}
            <Section
              title="Verify These"
              badge={verify.length}
              badgeColor="bg-amber-100 text-amber-700"
              empty="Nothing to verify right now."
            >
              {verify.map(r => <VerifyCard key={r.id} r={r} />)}
            </Section>

            {/* Unlock Later */}
            <Section
              title="Unlock Later"
              badge={locked.length}
              badgeColor="bg-gray-100 text-gray-500"
              empty="No locked strategies."
            >
              {locked.map(r => <LockedCard key={r.id} r={r} />)}
            </Section>

            {/* CTA */}
            <div className="flex items-center justify-between pt-2 pb-4">
              <p className="text-xs text-gray-400">
                Estimates are illustrative — consult a tax professional before acting.
              </p>
              <Link
                href="/dashboard/audit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Update my numbers
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

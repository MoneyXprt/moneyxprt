'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot, saveSnapshot } from '@/app/lib/snapshots';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChangeType =
  | 'income_changed'
  | 'bought_rental'
  | 'business_revenue_changed'
  | 'spouse_situation_changed'
  | 'paid_off_debt'
  | 'expenses_changed'
  | 'implemented_tax_strategy'
  | 'something_else';

interface FollowupInputs {
  newW2Income: number;
  rentalCashFlow: number;
  rentalPropertyValue: number;
  newBusinessRevenue: number;
  spouseSituationText: string;
  debtPaidOff: number;
  newMonthlyExpenses: number;
  taxStrategyText: string;
  somethingElseText: string;
}

const CHANGE_CARDS: {
  id: ChangeType;
  title: string;
  sub: string;
  icon: string;
}[] = [
  { id: 'income_changed',             title: 'My income changed',               sub: 'Raise, new job, or bonus changed',               icon: '💼' },
  { id: 'bought_rental',              title: 'I bought a rental property',       sub: 'Add the monthly cash flow to your plan',         icon: '🏠' },
  { id: 'business_revenue_changed',   title: 'My business revenue changed',      sub: 'Your LLC, consulting, or side income',            icon: '📊' },
  { id: 'spouse_situation_changed',   title: "My spouse's situation changed",    sub: 'Job change, new income, or other update',        icon: '👥' },
  { id: 'paid_off_debt',              title: 'I paid off debt',                  sub: 'Student loans, credit cards, car payments',      icon: '✅' },
  { id: 'expenses_changed',           title: 'My expenses changed',              sub: 'New mortgage, lifestyle change, kids',            icon: '📉' },
  { id: 'implemented_tax_strategy',   title: 'I implemented a tax strategy',     sub: 'REPS status, backdoor Roth, Augusta rule',        icon: '🧾' },
  { id: 'something_else',             title: 'Something else',                   sub: "Tell us what's different",                       icon: '💬' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function applyChanges(
  base: FinancialSnapshot,
  selected: Set<ChangeType>,
  inputs: FollowupInputs,
): FinancialSnapshot {
  const next = { ...base };

  if (selected.has('income_changed') && inputs.newW2Income > 0) {
    next.w2Income = inputs.newW2Income;
  }
  if (selected.has('bought_rental') && inputs.rentalCashFlow > 0) {
    next.monthlyRentalIncome = base.monthlyRentalIncome + inputs.rentalCashFlow;
    next.consideringRealEstate = false;
  }
  if (selected.has('business_revenue_changed') && inputs.newBusinessRevenue > 0) {
    next.businessRevenue = inputs.newBusinessRevenue * 12;
    next.primaryBusinessNetProfit = Math.round(inputs.newBusinessRevenue * 12 * 0.35);
  }
  if (selected.has('paid_off_debt') && inputs.debtPaidOff > 5_000) {
    // Approximate freed-up monthly payment (48-month avg term), capped at $400
    const freedMonthly = Math.min(Math.round(inputs.debtPaidOff / 48), 400);
    next.monthlySpend = Math.max(0, base.monthlySpend - freedMonthly);
  }
  if (selected.has('expenses_changed') && inputs.newMonthlyExpenses > 0) {
    next.monthlySpend = inputs.newMonthlyExpenses;
  }

  return next;
}

// ─── Number input ─────────────────────────────────────────────────────────────

function NumInput({
  label, value, onChange, prefix = '$', placeholder = '0',
}: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; placeholder?: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">{prefix}</span>
        <input
          type="number"
          min="0"
          value={value || ''}
          placeholder={placeholder}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="w-full pl-7 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white"
        />
      </div>
    </div>
  );
}

function TextInput({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <textarea
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white resize-none"
      />
    </div>
  );
}

// ─── Change card ──────────────────────────────────────────────────────────────

function ChangeCard({
  card, selected, snapshot, inputs, onToggle, onInput,
}: {
  card: typeof CHANGE_CARDS[number];
  selected: boolean;
  snapshot: FinancialSnapshot | null;
  inputs: FollowupInputs;
  onToggle: () => void;
  onInput: (k: keyof FollowupInputs, v: number | string) => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left rounded-2xl border transition-all ${
        selected
          ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      } shadow-sm overflow-hidden`}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="text-2xl shrink-0">{card.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">{card.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-tight">{card.sub}</p>
        </div>
        <div className={`w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center transition ${
          selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-200'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {/* Follow-up inputs — only visible when selected */}
      {selected && (
        <div className="px-4 pb-4 border-t border-emerald-100" onClick={e => e.stopPropagation()}>
          {card.id === 'income_changed' && (
            <NumInput
              label={`New annual W2 income (current: ${snapshot ? fmt(snapshot.w2Income) : '—'})`}
              value={inputs.newW2Income}
              onChange={v => onInput('newW2Income', v)}
              placeholder="120000"
            />
          )}
          {card.id === 'bought_rental' && (
            <>
              <NumInput
                label="Monthly cash flow from property"
                value={inputs.rentalCashFlow}
                onChange={v => onInput('rentalCashFlow', v)}
                placeholder="800"
              />
              <NumInput
                label="Property value (optional)"
                value={inputs.rentalPropertyValue}
                onChange={v => onInput('rentalPropertyValue', v)}
                placeholder="300000"
              />
            </>
          )}
          {card.id === 'business_revenue_changed' && (
            <NumInput
              label={`New monthly revenue (current: ${snapshot ? fmt(snapshot.businessRevenue / 12) : '—'}/mo)`}
              value={inputs.newBusinessRevenue}
              onChange={v => onInput('newBusinessRevenue', v)}
              placeholder="15000"
            />
          )}
          {card.id === 'spouse_situation_changed' && (
            <TextInput
              label="What changed?"
              value={inputs.spouseSituationText}
              onChange={v => onInput('spouseSituationText', v)}
              placeholder="New job, left workforce, started a business..."
            />
          )}
          {card.id === 'paid_off_debt' && (
            <NumInput
              label="Amount paid off"
              value={inputs.debtPaidOff}
              onChange={v => onInput('debtPaidOff', v)}
              placeholder="25000"
            />
          )}
          {card.id === 'expenses_changed' && (
            <NumInput
              label={`New monthly spend (current: ${snapshot ? fmt(snapshot.monthlySpend) : '—'}/mo)`}
              value={inputs.newMonthlyExpenses}
              onChange={v => onInput('newMonthlyExpenses', v)}
              placeholder="8000"
            />
          )}
          {card.id === 'implemented_tax_strategy' && (
            <TextInput
              label="Which strategy?"
              value={inputs.taxStrategyText}
              onChange={v => onInput('taxStrategyText', v)}
              placeholder="REPS status, backdoor Roth IRA, Augusta rule..."
            />
          )}
          {card.id === 'something_else' && (
            <TextInput
              label="Tell us what changed"
              value={inputs.somethingElseText}
              onChange={v => onInput('somethingElseText', v)}
              placeholder="Describe the change and how it affects your finances..."
            />
          )}
        </div>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdjustPage() {
  const router = useRouter();
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [snapshot, setSnapshot]       = useState<FinancialSnapshot | null>(null);
  const [celebrationIncome, setCelebrationIncome] = useState(0);

  const [selected, setSelected] = useState<Set<ChangeType>>(new Set());
  const [inputs, setInputs]     = useState<FollowupInputs>({
    newW2Income:          0,
    rentalCashFlow:       0,
    rentalPropertyValue:  0,
    newBusinessRevenue:   0,
    spouseSituationText:  '',
    debtPaidOff:          0,
    newMonthlyExpenses:   0,
    taxStrategyText:      '',
    somethingElseText:    '',
  });

  // ── Auth + data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (!s) { setLoading(false); return; }
      getLatestSnapshot()
        .then(snap => { setSnapshot(snap); setLoading(false); })
        .catch(() => setLoading(false));
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Toggle card selection ─────────────────────────────────────────────────
  function toggle(id: ChangeType) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function setInput(k: keyof FollowupInputs, v: number | string) {
    setInputs(prev => ({ ...prev, [k]: v }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || selected.size === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      if (!snapshot) {
        // No existing snapshot — just navigate to the full audit
        router.push('/dashboard/audit');
        return;
      }

      const updatedSnapshot = applyChanges(snapshot, selected, inputs);
      await saveSnapshot(updatedSnapshot);
      const boughtRental = selected.has('bought_rental') && inputs.rentalCashFlow > 0;
      if (boughtRental) {
        setCelebrationIncome(inputs.rentalCashFlow);
      } else {
        router.push('/dashboard/plan/results');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sign in to update your plan.</p>
          <Link href="/dashboard" className="text-emerald-600 font-semibold hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  // ── Acquisition celebration overlay ──────────────────────────────────────
  if (celebrationIncome > 0) {
    const fmtM = (n: number) =>
      n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString()}`;
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
        style={{ background: 'linear-gradient(160deg, #1B3A2D 0%, #0f2318 100%)' }}
      >
        {/* Gold star burst */}
        <div style={{ fontSize: '56px', lineHeight: 1, marginBottom: '24px' }}>★</div>

        <p
          className="text-xs font-bold uppercase tracking-widest mb-3"
          style={{ color: '#C9A84C' }}
        >
          First Asset Acquired
        </p>

        <h1 className="text-3xl font-extrabold text-white mb-3 leading-tight">
          You just changed<br />your financial trajectory.
        </h1>

        <p className="text-base text-emerald-300 font-semibold mb-2 tabular-nums">
          +{fmtM(celebrationIncome)}/month new passive income
        </p>
        <p className="text-sm text-gray-400 mb-10">
          Your Freedom Score just jumped +10 points. Your plan is being updated now.
        </p>

        <button
          onClick={() => router.push('/dashboard/plan/results')}
          className="w-full max-w-xs rounded-xl font-bold text-base py-4 transition"
          style={{ background: '#C9A84C', color: '#1B3A2D' }}
        >
          See my updated plan →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-700 transition">← Dashboard</Link>
          </div>
          <button
            onClick={() => getBrowserSupabaseClient().auth.signOut()}
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {loading ? (
        <div className="max-w-lg mx-auto px-4 py-8 space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <main className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-12">

            {/* Heading */}
            <div>
              <h1 className="text-xl font-bold text-gray-900">What changed?</h1>
              <p className="text-sm text-gray-500 mt-1">Tell us what&apos;s different and we&apos;ll update your plan.</p>
            </div>

            {/* No snapshot warning */}
            {!snapshot && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                No financial snapshot found.{' '}
                <Link href="/dashboard/audit" className="font-semibold underline">Complete your audit first →</Link>
              </div>
            )}

            {/* Change cards */}
            <div className="space-y-3">
              {CHANGE_CARDS.map(card => (
                <ChangeCard
                  key={card.id}
                  card={card}
                  selected={selected.has(card.id)}
                  snapshot={snapshot}
                  inputs={inputs}
                  onToggle={() => toggle(card.id)}
                  onInput={setInput}
                />
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || selected.size === 0}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-base hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? 'Updating your plan…' : `Update my plan →`}
            </button>

            {selected.size === 0 && (
              <p className="text-center text-xs text-gray-400">Select at least one change above</p>
            )}

            <Link
              href="/dashboard"
              className="flex items-center justify-center w-full py-2 text-sm text-gray-400 hover:text-gray-700 transition"
            >
              Cancel — nothing changed
            </Link>

          </main>
        </form>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { estimateNetBonus } from '@/app/lib/deployableCapital';
import { recordCascadingDebtPayment, type PaidOffInfo } from '@/app/lib/debtPayments';
import { syncFinancialPhase } from '@/app/lib/financialPhaseSync';
import type { Session } from '@supabase/supabase-js';

// ─── Unapplied bonus → debt ─────────────────────────────────────────────────

interface UnappliedBonusRow {
  id: string;
  amount: number;
  net_amount: number | null;
  deployable_amount: number | null;
  date_paid: string;
}

interface DebtSummaryRow {
  id: string;
  current_balance: number;
}

interface RecentPaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  debts: { name: string } | null;
}

function fmtUsd(v: number) {
  return `$${Math.round(v).toLocaleString()}`;
}

// ─── Loggable items registry ───────────────────────────────────────────────────
// Add a new entry here to add a new card to the hub — nothing else on this page
// needs to change.

interface LoggableItem {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const LOGGABLE_ITEMS: LoggableItem[] = [
  { id: 'cash-flow', title: 'Cash Flow Calendar', description: 'Plan paydays, bills, goals, and investing in one monthly view.', href: '/dashboard/cash-flow', icon: <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14M5 5h14v16H5z" /></svg> },
  {
    id: 'investments', title: 'Investment Returns', description: 'Record portfolio values and compare your cash-flow-adjusted return with the S&P 500.', href: '/dashboard/investments',
    icon: <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-9M14 6h7v7" /></svg>,
  },
  {
    id: 'goal-buckets',
    title: 'Goal Buckets',
    description: 'Set aside money for the goals that matter and keep a clear view of what is funded and what remains.',
    href: '/dashboard/goals',
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3m15.5-5.5a7.5 7.5 0 11-13 0" />
      </svg>
    ),
  },
  {
    id: 'net-worth',
    title: 'Net Worth',
    description: 'Save a quick monthly check-in for cash, investments, and debt. Track the trend without connecting your accounts.',
    href: '/dashboard/net-worth',
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-5 3 3 5-7" />
      </svg>
    ),
  },
  {
    id: 'bonus-payments',
    title: 'Bonus Payments',
    description: 'Log gross and net amounts as bonuses are actually paid, so your deployable capital uses real numbers instead of a withholding estimate.',
    href: '/dashboard/bonus-log',
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 2v8m0 0v2m0-2c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'debts',
    title: 'Debts',
    description: 'View your active debts ranked by payoff order, track progress, and log payments as you make them.',
    href: '/dashboard/debts',
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

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
      options: { emailRedirectTo: `${window.location.origin}/dashboard/actuals` },
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
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
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
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
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

// ─── Loggable item card ─────────────────────────────────────────────────────────

function LoggableItemCard({ item }: { item: LoggableItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 hover:bg-gray-50 hover:border-emerald-500 hover:shadow-md transition"
    >
      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>
      </div>
      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ActualsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [unappliedBonuses, setUnappliedBonuses] = useState<UnappliedBonusRow[]>([]);
  const [applyingId, setApplyingId]             = useState<string | null>(null);
  const [applyError, setApplyError]             = useState<string | null>(null);
  // Array — a single cascading apply can pay off more than one debt in one action.
  const [payoffCelebrations, setPayoffCelebrations] = useState<PaidOffInfo[]>([]);
  const [pendingBonusCount, setPendingBonusCount]   = useState(0);
  const [activeDebts, setActiveDebts]               = useState<DebtSummaryRow[]>([]);
  const [recentPayments, setRecentPayments]         = useState<RecentPaymentRow[]>([]);

  const fetchUnappliedBonuses = useCallback(async (userId: string) => {
    const sb = getBrowserSupabaseClient();
    const [bonusesResult, debtResult, paymentsResult] = await Promise.all([
      sb.from('bonus_payments_actual')
        .select('id, amount, net_amount, deployable_amount, date_paid')
        .eq('user_id', userId)
        .eq('applied_to_debt', false)
        .order('date_paid', { ascending: false }),
      sb.from('debts')
        .select('id, current_balance')
        .eq('user_id', userId)
        .eq('is_active', true),
      sb.from('debt_payments')
        .select('id, amount, payment_date, debts(name)')
        .eq('user_id', userId)
        .order('payment_date', { ascending: false })
        .limit(5),
    ]);
    setUnappliedBonuses((bonusesResult.data ?? []) as UnappliedBonusRow[]);
    setPendingBonusCount((bonusesResult.data ?? []).length);
    setActiveDebts((debtResult.data ?? []) as DebtSummaryRow[]);
    setRecentPayments((paymentsResult.data ?? []) as unknown as RecentPaymentRow[]);
  }, []);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) fetchUnappliedBonuses(s.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This is a manual, explicit action — never automatic. The user must click
  // "Apply to debt" for each bonus payment individually.
  const handleApplyToDebt = async (bonus: UnappliedBonusRow) => {
    if (!session || applyingId) return;
    setApplyingId(bonus.id);
    setApplyError(null);
    try {
      const sb = getBrowserSupabaseClient();
      const userId = session.user.id;

      const { data: topDebt, error: debtError } = await sb
        .from('debts')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('payoff_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (debtError) throw debtError;
      if (!topDebt) {
        setApplyError('No active debts to apply this to — migrate or add a debt first.');
        return;
      }

      const appliedAmount = bonus.deployable_amount ?? bonus.net_amount ?? estimateNetBonus(bonus.amount);

      // Cascading — a lump sum can exceed the top debt's balance, in which case the
      // remainder rolls into subsequently-ranked active debts (each getting its own
      // debt_payments row) until the amount is exhausted or debts run out.
      const { paidOffInfos } = await recordCascadingDebtPayment(sb, {
        userId,
        startDebtId: topDebt.id,
        amount:      appliedAmount,
        paymentDate: bonus.date_paid,
        source:      'lump_sum',
        note:        'Applied from logged bonus payment',
      });

      const { error: updateBonusError } = await sb
        .from('bonus_payments_actual')
        .update({ applied_to_debt: true })
        .eq('id', bonus.id);
      if (updateBonusError) throw updateBonusError;

      if (paidOffInfos.length > 0) {
        setPayoffCelebrations(paidOffInfos);
        // Paying off a debt is the only debt-side event that can change hasActiveDebts
        // (a regular partial payment never does) — recompute here, not on every payment.
        try {
          await syncFinancialPhase(sb, userId);
        } catch (err) {
          console.warn('syncFinancialPhase failed:', err instanceof Error ? err.message : err);
        }
      }

      await fetchUnappliedBonuses(userId);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply payment. Please try again.');
    } finally {
      setApplyingId(null);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return <AuthGate onSession={setSession} />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top nav ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Actuals</span>
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Actuals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record real-world progress. Your plan uses these numbers instead of estimates.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Active debt</p>
            <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
              {fmtUsd(activeDebts.reduce((sum, debt) => sum + Number(debt.current_balance), 0))}
            </p>
            <p className="text-xs text-gray-500">{activeDebts.length} account{activeDebts.length === 1 ? '' : 's'} remaining</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Needs allocation</p>
            <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{pendingBonusCount}</p>
            <p className="text-xs text-gray-500">bonus payment{pendingBonusCount === 1 ? '' : 's'} waiting</p>
          </div>
        </div>

        {/* ── Debt paid off celebration(s) ──────────────────────────────
            Display only — freedMinimumPayment is not yet wired into any
            deployable-capital calculation. A single cascading apply can pay off more
            than one debt, so this renders one banner per debt paid off. */}
        {payoffCelebrations.map((celebration, i) => (
          <div key={`${celebration.paidOffName}-${i}`} className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 relative">
            <button
              type="button"
              onClick={() => setPayoffCelebrations(prev => prev.filter((_, idx) => idx !== i))}
              aria-label="Dismiss"
              className="absolute top-3 right-3 text-emerald-400 hover:text-emerald-700 transition text-sm leading-none"
            >
              ✕
            </button>
            <p className="text-sm font-bold text-emerald-900 pr-6">🎉 {celebration.paidOffName} paid off!</p>
            <p className="text-xs text-emerald-800 mt-1.5 leading-relaxed">
              That frees up {fmtUsd(celebration.freedMinimumPayment)}/month you were paying toward it.
              {celebration.nextDebtName
                ? ` Consider redirecting it toward ${celebration.nextDebtName}, your next-ranked debt.`
                : ' You have no other active debts — consider redirecting it toward savings or investing.'}
            </p>
          </div>
        ))}

        {/* ── Unapplied bonus payments → debt ─────────────────────────── */}
        {unappliedBonuses.length > 0 && (
          <div className="space-y-3">
            {unappliedBonuses.map(bonus => {
              const appliedAmount = bonus.deployable_amount ?? bonus.net_amount ?? estimateNetBonus(bonus.amount);
              const isNetKnown    = bonus.net_amount != null;
              return (
                <div key={bonus.id} className="bg-white rounded-2xl border border-indigo-100 shadow-sm px-5 py-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {fmtUsd(bonus.amount)} bonus logged on {new Date(bonus.date_paid + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Apply {fmtUsd(appliedAmount)} ({isNetKnown ? 'logged net' : 'estimated net after withholding'}) to your top-ranked active debt.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleApplyToDebt(bonus)}
                    disabled={applyingId === bonus.id}
                    className="mt-3 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 transition"
                  >
                    {applyingId === bonus.id ? 'Applying…' : `Apply ${fmtUsd(appliedAmount)} to debt`}
                  </button>
                </div>
              );
            })}
            {applyError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{applyError}</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {LOGGABLE_ITEMS.map(item => (
            <LoggableItemCard key={item.id} item={item} />
          ))}
        </div>

        {recentPayments.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent debt payments</h2>
            <div className="mt-3 divide-y divide-gray-100">
              {recentPayments.map(payment => (
                <div key={payment.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{payment.debts?.name ?? 'Debt payment'}</p>
                    <p className="text-[11px] text-gray-400">{new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 tabular-nums">−{fmtUsd(payment.amount)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

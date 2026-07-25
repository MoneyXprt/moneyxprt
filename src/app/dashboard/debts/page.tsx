'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { recordDebtPayment, type PaidOffInfo } from '@/app/lib/debtPayments';
import { syncFinancialPhase } from '@/app/lib/financialPhaseSync';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebtRow {
  id: string;
  name: string;
  debt_type: string;
  original_balance: number;
  current_balance: number;
  interest_rate: number;
  minimum_payment: number;
  is_active: boolean;
  payoff_order: number | null;
  paid_off_at: string | null;
}

function fmtUsd(v: number) {
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Native <input type="date"> pre-filled with a value can require the click to land
// precisely on the calendar icon before the browser opens the picker — forcing it via
// showPicker() makes a single click/focus reliable regardless of where it lands.
// showPicker() isn't supported in every browser (older Safari), so the feature check +
// try/catch fail silently and fall back to normal native click behavior there.
function openDatePicker(e: React.SyntheticEvent<HTMLInputElement>) {
  try {
    const input = e.currentTarget;
    if (typeof input.showPicker === 'function') input.showPicker();
  } catch { /* unsupported browser — falls back to native click behavior */ }
}

function percentPaidOff(d: DebtRow): number {
  if (d.original_balance <= 0) return 0;
  const pct = ((d.original_balance - d.current_balance) / d.original_balance) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
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
      options: { emailRedirectTo: `${window.location.origin}/dashboard/debts` },
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 2v8m0 0v2m0-2c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

// ─── Active debt card ─────────────────────────────────────────────────────────

function ActiveDebtCard({
  debt,
  rank,
  onLogPayment,
}: {
  debt: DebtRow;
  rank: number;
  onLogPayment: (debtId: string, amount: number, date: string) => Promise<void>;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount]     = useState('');
  const [date, setDate]         = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const pct = percentPaidOff(debt);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(amount.replace(/,/g, ''));
    if (!n || n <= 0 || !date) return;
    setSubmitting(true); setError(null);
    try {
      await onLogPayment(debt.id, n, date);
      setAmount(''); setDate(todayIso()); setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold shrink-0">
            {rank}
          </span>
          <p className="text-sm font-semibold text-gray-900">{debt.name}</p>
        </div>
        <p className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{fmtUsd(debt.current_balance)}</p>
      </div>

      <div className="mt-2.5">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-400">{pct}% paid off</span>
          <span className="text-[10px] text-gray-400">of {fmtUsd(debt.original_balance)} original</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-500">
        <span>{debt.interest_rate.toFixed(2)}% APR</span>
        <span>{fmtUsd(debt.minimum_payment)}/mo minimum</span>
      </div>

      {formOpen ? (
        <form onSubmit={submit} className="mt-3 pt-3 border-t border-gray-50 space-y-2.5">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-xs pointer-events-none">$</span>
                <input type="text" inputMode="numeric" required value={amount}
                  onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={() => {
                    const clean = amount.replace(/,/g, '');
                    const num = Number(clean);
                    if (clean && !isNaN(num) && num > 0) setAmount(num.toLocaleString('en-US'));
                  }}
                  placeholder="0"
                  className="w-full pl-6 pr-2.5 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                onClick={openDatePicker} onFocus={openDatePicker}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            </div>
          </div>
          {error && <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={submitting}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60 transition">
              {submitting ? 'Saving…' : 'Save payment'}
            </button>
            <button type="button" onClick={() => { setFormOpen(false); setError(null); }}
              className="px-3 py-1.5 rounded-lg text-gray-400 text-xs hover:text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setFormOpen(true)}
          className="mt-3 w-full py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
          Log a payment
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DebtsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [activeDebts, setActiveDebts] = useState<DebtRow[]>([]);
  const [paidOffDebts, setPaidOffDebts] = useState<DebtRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]     = useState<string | null>(null);
  const [payoffCelebration, setPayoffCelebration] = useState<PaidOffInfo | null>(null);

  const fetchDebts = useCallback(async (userId: string) => {
    setListLoading(true); setListError(null);
    const sb = getBrowserSupabaseClient();
    const [{ data: active, error: activeError }, { data: paidOff, error: paidOffError }] = await Promise.all([
      sb.from('debts').select('*').eq('user_id', userId).eq('is_active', true).order('payoff_order', { ascending: true }),
      sb.from('debts').select('*').eq('user_id', userId).eq('is_active', false).order('paid_off_at', { ascending: false }),
    ]);
    if (activeError || paidOffError) {
      setListError((activeError ?? paidOffError)?.message ?? 'Failed to load debts.');
    } else {
      setActiveDebts((active ?? []) as DebtRow[]);
      setPaidOffDebts((paidOff ?? []) as DebtRow[]);
    }
    setListLoading(false);
  }, []);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) fetchDebts(s.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogPayment = async (debtId: string, amount: number, date: string) => {
    if (!session) return;
    const sb = getBrowserSupabaseClient();
    const { paidOffInfo } = await recordDebtPayment(sb, {
      userId: session.user.id,
      debtId,
      amount,
      paymentDate: date,
      source: 'regular',
    });
    if (paidOffInfo) {
      setPayoffCelebration(paidOffInfo);
      // Paying off a debt is the only debt-side event that can change hasActiveDebts
      // (a regular partial payment never does) — recompute here, not on every payment.
      try {
        await syncFinancialPhase(sb, session.user.id);
      } catch (err) {
        console.warn('syncFinancialPhase failed:', err instanceof Error ? err.message : err);
      }
    }
    await fetchDebts(session.user.id);
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
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href="/dashboard/actuals" className="text-sm text-gray-400 hover:text-gray-700 transition shrink-0">← Actuals</Link>
            <span className="text-gray-200 shrink-0">/</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm hidden sm:inline">MoneyXprt</span>
            <span className="text-gray-300 hidden sm:inline">/</span>
            <span className="text-sm text-gray-500">Debts</span>
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-28 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Debts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ranked by snowball payoff order — smallest balance first.
          </p>
        </div>

        {payoffCelebration && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 relative">
            <button
              type="button"
              onClick={() => setPayoffCelebration(null)}
              aria-label="Dismiss"
              className="absolute top-3 right-3 text-emerald-400 hover:text-emerald-700 transition text-sm leading-none"
            >
              ✕
            </button>
            <p className="text-sm font-bold text-emerald-900 pr-6">🎉 {payoffCelebration.paidOffName} paid off!</p>
            <p className="text-xs text-emerald-800 mt-1.5 leading-relaxed">
              That frees up {fmtUsd(payoffCelebration.freedMinimumPayment)}/month you were paying toward it.
              {payoffCelebration.nextDebtName
                ? ` Consider redirecting it toward ${payoffCelebration.nextDebtName}, your next-ranked debt.`
                : ' You have no other active debts — consider redirecting it toward savings or investing.'}
            </p>
          </div>
        )}

        {listError && (
          <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 text-sm text-red-700">{listError}</div>
        )}

        {listLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />)}
          </div>
        ) : (
          <>
            {activeDebts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-8 text-center">
                <p className="text-sm text-gray-500">No active debts on file yet.</p>
                <p className="text-xs text-gray-400 mt-1">Fill in the Liabilities section of your Financial Snapshot to sync debts here automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDebts.map((debt, i) => (
                  <ActiveDebtCard key={debt.id} debt={debt} rank={i + 1} onLogPayment={handleLogPayment} />
                ))}
              </div>
            )}

            {paidOffDebts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-0.5">Paid off</p>
                <div className="space-y-2">
                  {paidOffDebts.map(debt => (
                    <div key={debt.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 flex items-center justify-between opacity-70">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{debt.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {debt.paid_off_at ? `Paid off ${fmtDate(debt.paid_off_at)}` : 'Paid off'}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

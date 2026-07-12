'use client';

import { useState, useEffect, useCallback } from 'react';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { syncCapitalPerYear } from '@/app/lib/capitalPerYearSync';
import type { Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BonusPaymentRow {
  id: string;
  amount: number;
  net_amount: number | null;
  date_paid: string;
  created_at: string;
}

const n = (v: string) => (v === '' ? 0 : parseFloat(v.replace(/,/g, '')) || 0);

function fmt(v: number) {
  return `$${Math.round(v).toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
      options: { emailRedirectTo: `${window.location.origin}/dashboard/bonus-log` },
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BonusLogPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [amount, setAmount]       = useState('');
  const [netAmount, setNetAmount] = useState('');
  const [datePaid, setDatePaid]   = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [payments, setPayments]     = useState<BonusPaymentRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError]   = useState<string | null>(null);

  // ── Session init ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch payments ───────────────────────────────────────────────────────
  const fetchPayments = useCallback(async () => {
    if (!session) return;
    setListLoading(true); setListError(null);
    const sb = getBrowserSupabaseClient();
    const { data, error } = await sb
      .from('bonus_payments_actual')
      .select('id, amount, net_amount, date_paid, created_at')
      .eq('user_id', session.user.id)
      .order('date_paid', { ascending: false });
    if (error) setListError(error.message);
    else setPayments(data as BonusPaymentRow[]);
    setListLoading(false);
  }, [session]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Next.js's Router Cache can preserve this page's mounted instance across
  // client-side back/forward navigation, so the mount effect above never reruns and
  // a payment logged elsewhere (or in another tab) silently never shows up on revisit.
  // Refetch whenever the tab regains focus or becomes visible again.
  useEffect(() => {
    const onFocus = () => { fetchPayments(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPayments();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchPayments]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || n(amount) <= 0 || !datePaid) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const sb = getBrowserSupabaseClient();
      const { error } = await sb.from('bonus_payments_actual').insert({
        user_id:    session.user.id,
        amount:     n(amount),
        net_amount: netAmount.trim() ? n(netAmount) : null,
        date_paid:  datePaid,
      });
      if (error) throw error;
      setAmount(''); setNetAmount(''); setDatePaid(todayIso());
      await fetchPayments();

      // A logged/edited bonus payment changes computeAnnualDeployableTotal's result —
      // refresh capital_per_year so it doesn't go stale. Same never-block-the-save
      // treatment as everywhere else this is called.
      try {
        await syncCapitalPerYear(sb, session.user.id);
      } catch (err) {
        console.warn('syncCapitalPerYear failed:', err instanceof Error ? err.message : err);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!session) return;
    const sb = getBrowserSupabaseClient();
    const { error } = await sb.from('bonus_payments_actual').delete().eq('id', id);
    if (!error) {
      setPayments(prev => prev.filter(p => p.id !== id));

      // Deleting a logged payment changes computeAnnualDeployableTotal's result exactly
      // as much as adding one does — refresh capital_per_year. Never blocks the delete.
      try {
        await syncCapitalPerYear(sb, session.user.id);
      } catch (err) {
        console.warn('syncCapitalPerYear failed:', err instanceof Error ? err.message : err);
      }
    }
  };

  // ── Render guards ────────────────────────────────────────────────────────
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Bonus Log</span>
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bonus Payments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Log each bonus as it&apos;s actually paid — gross amount, and net if you know it, so your deployable capital estimate uses real numbers instead of a withholding estimate.
          </p>
        </div>

        {/* ── Log a payment ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Log a payment</h2>
            <p className="mt-0.5 text-xs text-gray-400">Net amount is optional — leave it blank and we&apos;ll estimate withholding for you.</p>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount (gross)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">$</span>
                <input type="number" min="0" required value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Net amount received (optional)</label>
              <p className="text-xs text-gray-400 mb-1.5">What actually landed in your account, after withholding.</p>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">$</span>
                <input type="number" min="0" value={netAmount} onChange={e => setNetAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date paid</label>
              <input type="date" required value={datePaid} onChange={e => setDatePaid(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
            </div>
            {submitError && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <p className="text-xs text-red-700">{submitError}</p>
              </div>
            )}
            <button type="submit" disabled={submitting || n(amount) <= 0}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
              {submitting ? 'Saving…' : 'Save payment'}
            </button>
          </form>
        </div>

        {/* ── History ────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Payment history</h2>
          </div>
          {listError ? (
            <div className="px-5 py-6 text-sm text-red-600 bg-red-50">{listError}</div>
          ) : listLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2].map(i => <div key={i} className="h-10 rounded-xl bg-gray-100 animate-pulse" />)}
            </div>
          ) : payments.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-gray-400">No payments logged yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-gray-900 font-medium">{fmt(Number(p.amount))} gross</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(p.date_paid)}
                      {p.net_amount != null && ` — ${fmt(Number(p.net_amount))} net`}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(p.id)}
                    className="text-xs text-gray-400 hover:text-red-600 transition px-2 py-1 rounded-lg hover:bg-red-50">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

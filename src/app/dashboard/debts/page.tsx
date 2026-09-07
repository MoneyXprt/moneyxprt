'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { DebtAuthGate } from '@/components/debts/DebtAuthGate';
import { DebtCorrectionModal } from '@/components/debts/DebtCorrectionModal';
import { DebtPaymentCard } from '@/components/debts/DebtPaymentCard';
import { PaidOffDebtCard } from '@/components/debts/PaidOffDebtCard';
import { correctDebtRecord, listDebtRecords, type DebtCorrectionChanges, type DebtRecord } from '@/app/lib/debtRecords';
import { recordDebtPayment, type PaidOffInfo } from '@/app/lib/debtPayments';
import { formatDebtUsd } from '@/app/lib/debtDisplay';
import { syncFinancialPhase } from '@/app/lib/financialPhaseSync';

/** Renders the debt tracker, payment entry, and narrow audit-logged correction flow. */
export default function DebtsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeDebts, setActiveDebts] = useState<DebtRecord[]>([]);
  const [paidOffDebts, setPaidOffDebts] = useState<DebtRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [payoffCelebration, setPayoffCelebration] = useState<PaidOffInfo | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<DebtRecord | null>(null);

  /** Loads the user's debts through the typed repository layer. */
  const loadDebts = useCallback(async (userId: string): Promise<void> => {
    setListLoading(true);
    setListError(null);
    try {
      const records = await listDebtRecords(userId);
      setActiveDebts(records.active);
      setPaidOffDebts(records.paidOff);
    } catch (caughtError) {
      setListError(caughtError instanceof Error ? caughtError.message : 'Failed to load debts.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    void client.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setSessionLoading(false);
      if (currentSession) void loadDebts(currentSession.user.id);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, [loadDebts]);

  /** Records a real debt payment through the existing payment workflow. */
  const handleLogPayment = async (debtId: string, amount: number, date: string): Promise<void> => {
    if (!session) return;
    const { paidOffInfo } = await recordDebtPayment(getBrowserSupabaseClient(), { userId: session.user.id, debtId, amount, paymentDate: date, source: 'regular' });
    if (paidOffInfo) {
      setPayoffCelebration(paidOffInfo);
      await syncFinancialPhase(getBrowserSupabaseClient(), session.user.id);
    }
    await loadDebts(session.user.id);
  };

  /** Saves a limited debt correction and refreshes derived financial state. */
  const handleCorrection = async (changes: DebtCorrectionChanges, reason: string): Promise<void> => {
    if (!session || !correctionTarget) return;
    await correctDebtRecord(correctionTarget.id, changes, reason);
    try {
      await syncFinancialPhase(getBrowserSupabaseClient(), session.user.id);
    } catch (caughtError) {
      console.warn('syncFinancialPhase failed after debt correction:', caughtError);
    }
    await loadDebts(session.user.id);
  };

  if (sessionLoading) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" /></div>;
  if (!session) return <DebtAuthGate onSession={setSession} />;

  return <div className="min-h-screen bg-gray-50"><header className="sticky top-0 z-10 border-b border-gray-100 bg-white"><div className="flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6"><div className="flex min-w-0 items-center gap-2.5"><Link href="/dashboard/actuals" className="flex min-h-11 items-center text-sm text-gray-500">← Actuals</Link><span className="text-sm font-semibold text-gray-900">Debts</span></div><button onClick={() => void getBrowserSupabaseClient().auth.signOut()} className="min-h-11 rounded-lg px-2.5 text-xs text-gray-500">Sign out</button></div></header><main className="mx-auto max-w-2xl space-y-5 px-4 pb-28 pt-8 sm:px-6"><div><h1 className="text-2xl font-bold tracking-tight text-gray-900">Debts</h1><p className="mt-1 text-sm text-gray-500">Ranked by snowball payoff order — smallest balance first.</p></div>{payoffCelebration && <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4"><button type="button" onClick={() => setPayoffCelebration(null)} aria-label="Dismiss" className="absolute right-2 top-2 min-h-11 min-w-11 text-emerald-700">×</button><p className="pr-8 text-sm font-bold text-emerald-900">🎉 {payoffCelebration.paidOffName} paid off!</p><p className="mt-1.5 text-xs leading-relaxed text-emerald-800">That frees up {formatDebtUsd(payoffCelebration.freedMinimumPayment)}/month. {payoffCelebration.nextDebtName ? `Consider redirecting it toward ${payoffCelebration.nextDebtName}.` : 'You have no other active debts.'}</p></div>}{listError && <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{listError}</p>}{listLoading ? <div className="space-y-3">{[1, 2, 3].map(index => <div key={index} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}</div> : <><section aria-labelledby="active-debts"><h2 id="active-debts" className="sr-only">Active debts</h2>{activeDebts.length ? <div className="space-y-3">{activeDebts.map((debt, index) => <DebtPaymentCard key={debt.id} debt={debt} rank={index + 1} onLogPayment={handleLogPayment} onCorrect={setCorrectionTarget} />)}</div> : <div className="rounded-2xl border border-gray-100 bg-white px-5 py-8 text-center shadow-sm"><p className="text-sm text-gray-500">No active debts on file yet.</p><p className="mt-1 text-xs text-gray-400">Fill in Liabilities in your Financial Snapshot to sync debts here.</p></div>}</section>{paidOffDebts.length > 0 && <section aria-labelledby="paid-off-debts"><h2 id="paid-off-debts" className="mb-3 px-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Paid off</h2><div className="space-y-2">{paidOffDebts.map(debt => <PaidOffDebtCard key={debt.id} debt={debt} onCorrect={setCorrectionTarget} />)}</div></section>}</> }</main>{correctionTarget && <DebtCorrectionModal debt={correctionTarget} onClose={() => setCorrectionTarget(null)} onSubmit={handleCorrection} />}</div>;
}

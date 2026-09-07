'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { FinancialObservation } from '@/app/lib/financialObservations';
import {
  listFinancialObservations,
  saveFinancialObservation,
} from '@/app/lib/financialObservationsRepository';
import { NetWorthCheckInForm, type NetWorthValues } from '@/components/netWorth/NetWorthCheckInForm';
import { NetWorthHistory } from '@/components/netWorth/NetWorthHistory';

const EMPTY_VALUES: NetWorthValues = { cash: 0, investments: 0, totalDebt: 0 };

function latestValue(observations: FinancialObservation[]): number {
  return observations.at(-1)?.value ?? 0;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Provides a manual, dated net-worth tracker without bank aggregation. */
export default function NetWorthPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<FinancialObservation[]>([]);
  const [values, setValues] = useState<NetWorthValues>(EMPTY_VALUES);

  const load = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const client = getBrowserSupabaseClient();
      const [cash, investments, debt, netWorth] = await Promise.all([
        listFinancialObservations(client, userId, 'cash'),
        listFinancialObservations(client, userId, 'investments'),
        listFinancialObservations(client, userId, 'total_debt'),
        listFinancialObservations(client, userId, 'net_worth'),
      ]);
      setValues({ cash: latestValue(cash), investments: latestValue(investments), totalDebt: latestValue(debt) });
      setHistory(netWorth);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load net-worth history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    client.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) void load(currentSession.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) void load(currentSession.user.id);
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const save = async (nextValues: NetWorthValues) => {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const client = getBrowserSupabaseClient();
      const observedOn = today();
      const netWorth = nextValues.cash + nextValues.investments - nextValues.totalDebt;
      await Promise.all([
        saveFinancialObservation(client, session.user.id, { metric: 'cash', value: nextValues.cash, observedOn, source: 'manual' }),
        saveFinancialObservation(client, session.user.id, { metric: 'investments', value: nextValues.investments, observedOn, source: 'manual' }),
        saveFinancialObservation(client, session.user.id, { metric: 'total_debt', value: nextValues.totalDebt, observedOn, source: 'manual' }),
        saveFinancialObservation(client, session.user.id, { metric: 'net_worth', value: netWorth, observedOn, source: 'manual' }),
      ]);
      await load(session.user.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your check-in.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50" />;
  if (!session) return <div className="min-h-screen bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">Sign in from <Link href="/dashboard" className="font-semibold text-emerald-700 underline">your dashboard</Link> to track net worth.</div>;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 pb-24">
      <div className="mx-auto max-w-lg space-y-5">
        <Link href="/dashboard/actuals" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">← Actuals</Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Net worth</h1>
          <p className="mt-1 text-sm leading-relaxed text-gray-500">A simple monthly check-in. You control the numbers; nothing connects to your bank.</p>
        </div>
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Today’s check-in</h2>
          <div className="mt-4"><NetWorthCheckInForm initialValues={values} submitting={submitting} onSubmit={save} /></div>
        </section>
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">History</h2>
          <div className="mt-4"><NetWorthHistory observations={history} /></div>
        </section>
      </div>
    </main>
  );
}

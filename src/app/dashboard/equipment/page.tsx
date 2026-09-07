'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import {
  addSection179EquipmentRecord,
  deleteSection179EquipmentRecord,
  listSection179EquipmentRecords,
  type Section179EquipmentRecord,
} from '@/app/lib/section179EquipmentRecords';
import { getEquipmentRequestedDeduction } from '@/app/lib/strategies/section179Shared';

const TODAY = new Date().toISOString().slice(0, 10);

/** Provides owner-scoped equipment intake for the Section 179 strategy. */
export default function EquipmentPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<Section179EquipmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [placedInServiceDate, setPlacedInServiceDate] = useState(TODAY);
  const [businessUsePercent, setBusinessUsePercent] = useState('100');

  /** Reloads the user's persisted equipment list. */
  const loadRecords = useCallback(async (userId: string): Promise<void> => {
    setLoading(true); setError(null);
    try { setRecords(await listSection179EquipmentRecords(userId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load equipment.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) void loadRecords(data.session.user.id); else setLoading(false);
    });
  }, [loadRecords]);

  /** Persists a new asset through the typed equipment repository. */
  async function addAsset(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session) return;
    setSaving(true); setError(null);
    try {
      const record = await addSection179EquipmentRecord(session.user.id, {
        description, purchasePrice: Number(purchasePrice), placedInServiceDate, businessUsePercent: Number(businessUsePercent),
      });
      setRecords(current => [record, ...current]);
      setDescription(''); setPurchasePrice(''); setBusinessUsePercent('100');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add equipment.'); }
    finally { setSaving(false); }
  }

  /** Removes a single equipment asset through the typed equipment repository. */
  async function removeAsset(id: string): Promise<void> {
    if (!session) return;
    setRemoving(id); setError(null);
    try { await deleteSection179EquipmentRecord(session.user.id, id); setRecords(current => current.filter(record => record.id !== id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove equipment.'); }
    finally { setRemoving(null); }
  }

  if (!session && !loading) return <main className="min-h-screen bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">Sign in from <Link href="/dashboard" className="font-semibold text-emerald-700 underline">your dashboard</Link> to track equipment.</main>;
  return <main className="min-h-screen bg-gray-50 px-4 py-8 pb-28"><div className="mx-auto max-w-lg space-y-5">
    <Link href="/dashboard/actuals" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700">← Actuals</Link>
    <div><h1 className="text-2xl font-bold text-gray-900">Equipment &amp; machinery</h1><p className="mt-1 text-sm text-gray-500">Record qualifying assets for the Section 179 deduction. Review the final treatment with your CPA.</p></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <form onSubmit={addAsset} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-gray-900">Add equipment asset</h2>
      <input required value={description} onChange={event => setDescription(event.target.value)} placeholder="Description (for example, embroidery machine)" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
      <input required inputMode="decimal" value={purchasePrice} onChange={event => setPurchasePrice(event.target.value)} placeholder="Purchase price" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
      <input required type="date" value={placedInServiceDate} onChange={event => setPlacedInServiceDate(event.target.value)} aria-label="Placed in service date" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
      <input required inputMode="decimal" value={businessUsePercent} onChange={event => setBusinessUsePercent(event.target.value)} placeholder="Business use percent" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" />
      <button disabled={saving} className="min-h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Adding…' : 'Add equipment asset'}</button>
    </form>
    <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-gray-900">Your equipment</h2>
      {loading ? <div className="mt-3 space-y-2"><div className="h-16 animate-pulse rounded-xl bg-gray-100" /><div className="h-16 animate-pulse rounded-xl bg-gray-100" /></div>
        : records.length === 0 ? <p className="mt-3 text-sm text-gray-500">No equipment assets on file yet.</p>
          : <div className="mt-3 divide-y divide-gray-100">{records.map(record => <article key={record.id} className="py-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{record.description}</p><p className="mt-1 text-xs text-gray-500">{record.placedInServiceDate} · {record.businessUsePercent}% business use</p><p className="mt-1 text-sm font-semibold text-emerald-700">${getEquipmentRequestedDeduction(record).toLocaleString()} deduction before shared annual limits</p></div><button type="button" onClick={() => void removeAsset(record.id)} disabled={removing === record.id} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-rose-700 disabled:opacity-60">{removing === record.id ? 'Removing…' : 'Remove'}</button></div></article>)}</div>}
    </section>
    <Link href="/dashboard/plan/results" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">Refresh my plan →</Link>
  </div></main>;
}

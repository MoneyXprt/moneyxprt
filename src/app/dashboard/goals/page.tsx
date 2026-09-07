'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { GOAL_CATEGORIES, type GoalBucket } from '@/app/lib/goalBuckets';
import { createGoalBucket, deleteGoalBucket, listGoalBuckets, updateGoalBucketAmount } from '@/app/lib/goalBucketsRepository';
import { GoalBucketCard } from '@/components/goals/GoalBucketCard';

function amount(value: string): number { return Number(value.replace(/[^0-9.-]/g, '')) || 0; }

/** Lets users create and fund manual financial goal buckets. */
export default function GoalsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [buckets, setBuckets] = useState<GoalBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [startingAmount, setStartingAmount] = useState('');
  const [category, setCategory] = useState<GoalBucket['category']>('emergency');
  const [targetDate, setTargetDate] = useState('');

  const load = useCallback(async (userId: string) => {
    setLoading(true);
    try { setBuckets(await listGoalBuckets(getBrowserSupabaseClient(), userId)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load goals.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    client.auth.getSession().then(({ data: { session: current } }) => { setSession(current); if (current) void load(current.user.id); else setLoading(false); });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, current) => { setSession(current); if (current) void load(current.user.id); });
    return () => subscription.unsubscribe();
  }, [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setSaving(true); setError(null);
    try {
      await createGoalBucket(getBrowserSupabaseClient(), session.user.id, {
        name, category, targetAmount: amount(target), currentAmount: amount(startingAmount), targetDate: targetDate || null,
      });
      setName(''); setTarget(''); setStartingAmount(''); setTargetDate('');
      await load(session.user.id);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not create goal.'); }
    finally { setSaving(false); }
  };

  const updateAmount = async (bucket: GoalBucket, currentAmount: number) => {
    setSaving(true); setError(null);
    try {
      const saved = await updateGoalBucketAmount(getBrowserSupabaseClient(), bucket, currentAmount);
      setBuckets(current => current.map(item => item.id === saved.id ? saved : item));
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not update goal.'); }
    finally { setSaving(false); }
  };

  const removeGoal = async (bucket: GoalBucket) => {
    if (!window.confirm(`Remove ${bucket.name}? This will delete its saved progress.`)) return;
    setSaving(true); setError(null);
    try {
      await deleteGoalBucket(getBrowserSupabaseClient(), bucket.id);
      setBuckets(current => current.filter(item => item.id !== bucket.id));
    } catch (removeError) { setError(removeError instanceof Error ? removeError.message : 'Could not remove goal.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="min-h-screen bg-gray-50" />;
  if (!session) return <div className="min-h-screen bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">Sign in from <Link href="/dashboard" className="font-semibold text-emerald-700 underline">your dashboard</Link> to manage goals.</div>;

  return <main className="min-h-screen bg-gray-50 px-4 py-8 pb-24"><div className="mx-auto max-w-lg space-y-5">
    <Link href="/dashboard/actuals" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">← Actuals</Link>
    <div><h1 className="text-2xl font-bold tracking-tight text-gray-900">Goal buckets</h1><p className="mt-1 text-sm text-gray-500">Give important money a job before it gets spent somewhere else.</p></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
    <form onSubmit={create} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Create a bucket</h2>
      <input aria-label="Goal name" required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Carlsbad house fund" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
      <div className="grid grid-cols-2 gap-3"><input aria-label="Target amount" required inputMode="decimal" value={target} onChange={event => setTarget(event.target.value)} placeholder="Target amount" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /><input aria-label="Already funded amount" inputMode="decimal" value={startingAmount} onChange={event => setStartingAmount(event.target.value)} placeholder="Already funded" className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></div>
      <div className="grid grid-cols-2 gap-3"><select aria-label="Goal category" value={category} onChange={event => setCategory(event.target.value as GoalBucket['category'])} className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-emerald-500">{GOAL_CATEGORIES.map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><input aria-label="Goal target date" type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500" /></div>
      <button disabled={saving} className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Create goal bucket'}</button>
    </form>
    <section className="space-y-3"><h2 className="text-sm font-semibold text-gray-900">Your buckets</h2>{buckets.length ? buckets.map(bucket => <GoalBucketCard key={bucket.id} bucket={bucket} saving={saving} onSaveAmount={updateAmount} onDelete={removeGoal} />) : <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">Create your first bucket for money with a purpose.</p>}</section>
  </div></main>;
}

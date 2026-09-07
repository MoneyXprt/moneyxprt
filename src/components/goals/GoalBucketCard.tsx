'use client';

import { useState } from 'react';
import { goalProgressPercent, type GoalBucket } from '@/app/lib/goalBuckets';

interface GoalBucketCardProps {
  bucket: GoalBucket;
  saving: boolean;
  onSaveAmount: (bucket: GoalBucket, amount: number) => Promise<void>;
  onDelete: (bucket: GoalBucket) => Promise<void>;
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** Displays a bucket's funding progress and supports a direct balance update. */
export function GoalBucketCard({ bucket, saving, onSaveAmount, onDelete }: GoalBucketCardProps) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(Math.round(bucket.currentAmount).toLocaleString('en-US'));
  const progress = goalProgressPercent(bucket);
  const remaining = Math.max(0, bucket.targetAmount - bucket.currentAmount);

  const save = async () => {
    const nextAmount = Number(amount.replace(/[^0-9.-]/g, '')) || 0;
    await onSaveAmount(bucket, nextAmount);
    setEditing(false);
  };

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{bucket.name}</p>
          <p className="mt-0.5 text-xs capitalize text-gray-500">{bucket.category}</p>
        </div>
        <p className="text-sm font-bold text-gray-900 tabular-nums">{progress}%</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-gray-500 tabular-nums">
        <span>{money(bucket.currentAmount)} funded</span>
        <span>{money(remaining)} remaining</span>
      </div>
      {bucket.targetDate && <p className="mt-2 text-xs text-gray-500">Target: {new Date(`${bucket.targetDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>}

      {editing ? (
        <div className="mt-4 flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Current funded amount</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">$</span>
            <input value={amount} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 py-2 pl-7 pr-2 text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60">Save</button>
          <button type="button" onClick={() => { setAmount(Math.round(bucket.currentAmount).toLocaleString('en-US')); setEditing(false); }} className="min-h-11 px-2 text-sm font-medium text-gray-500">Cancel</button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Update amount</button>
          <button type="button" disabled={saving} onClick={() => void onDelete(bucket)} className="min-h-11 rounded-xl border border-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60">Remove goal</button>
        </div>
      )}
    </article>
  );
}

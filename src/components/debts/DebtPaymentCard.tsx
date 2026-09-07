'use client';

import { useState, type FormEvent, type SyntheticEvent } from 'react';
import type { DebtRecord } from '@/app/lib/debtRecords';
import { formatDebtUsd, getDebtPaidOffPercent, getTodayIso } from '@/app/lib/debtDisplay';

interface DebtPaymentCardProps {
  debt: DebtRecord;
  rank: number;
  onCorrect: (debt: DebtRecord) => void;
  onLogPayment: (debtId: string, amount: number, date: string) => Promise<void>;
}

/** Opens a native date picker when the browser supports programmatic opening. */
function openDatePicker(event: SyntheticEvent<HTMLInputElement>): void {
  try {
    const input = event.currentTarget;
    if (typeof input.showPicker === 'function') input.showPicker();
  } catch {
    // Older browsers retain their normal date-input behavior.
  }
}

/** Renders an active debt, its payment entry form, and its correction action. */
export function DebtPaymentCard({ debt, rank, onCorrect, onLogPayment }: DebtPaymentCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percentPaidOff = getDebtPaidOffPercent(debt.originalBalance, debt.currentBalance);

  /** Saves a real payment without changing the correction workflow. */
  const submitPayment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !date) return;
    setSubmitting(true);
    setError(null);
    try {
      await onLogPayment(debt.id, parsedAmount, date);
      setAmount('');
      setDate(getTodayIso());
      setFormOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to log payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">{rank}</span>
          <p className="text-sm font-semibold text-gray-900">{debt.name}</p>
        </div>
        <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900">{formatDebtUsd(debt.currentBalance)}</p>
      </div>
      <div className="mt-2.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentPaidOff}%` }} /></div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400"><span>{percentPaidOff}% paid off</span><span>of {formatDebtUsd(debt.originalBalance)} original</span></div>
      </div>
      <div className="mt-2.5 flex items-center gap-4 text-xs text-gray-500"><span>{debt.interestRate.toFixed(2)}% APR</span><span>{formatDebtUsd(debt.minimumPayment)}/mo minimum</span></div>
      {formOpen ? (
        <form onSubmit={submitPayment} className="mt-3 space-y-2.5 border-t border-gray-50 pt-3">
          <div className="flex gap-2"><label className="min-w-0 flex-1 text-[10px] font-medium text-gray-500">Amount<input type="text" inputMode="decimal" required value={amount} onChange={event => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} placeholder="$0" className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-2.5 text-xs" /></label><label className="min-w-0 flex-1 text-[10px] font-medium text-gray-500">Date<input type="date" required value={date} onChange={event => setDate(event.target.value)} onClick={openDatePicker} onFocus={openDatePicker} className="mt-1 min-h-11 w-full rounded-lg border border-gray-200 px-2.5 text-xs" /></label></div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-60">{submitting ? 'Saving…' : 'Save payment'}</button><button type="button" onClick={() => { setFormOpen(false); setError(null); }} className="min-h-11 rounded-lg px-3 text-xs text-gray-600">Cancel</button></div>
        </form>
      ) : <button type="button" onClick={() => setFormOpen(true)} className="mt-3 min-h-11 w-full rounded-lg border border-gray-200 text-xs font-semibold text-gray-600">Log a payment</button>}
      <button type="button" onClick={() => onCorrect(debt)} className="mt-2 min-h-11 w-full rounded-lg text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-4">Correct this record</button>
    </article>
  );
}

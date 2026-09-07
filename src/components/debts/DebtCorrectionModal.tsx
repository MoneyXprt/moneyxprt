'use client';

import { useState, type FormEvent } from 'react';
import { DEBT_CORRECTION_MIN_REASON_LENGTH, type DebtCorrectionChanges, type DebtRecord } from '@/app/lib/debtRecords';
import { formatDebtUsd } from '@/app/lib/debtDisplay';

interface DebtCorrectionModalProps {
  debt: DebtRecord;
  onClose: () => void;
  onSubmit: (changes: DebtCorrectionChanges, reason: string) => Promise<void>;
}

/** Collects the limited, mandatory-reason correction for a debt record. */
export function DebtCorrectionModal({ debt, onClose, onSubmit }: DebtCorrectionModalProps) {
  const [originalBalance, setOriginalBalance] = useState(String(debt.originalBalance));
  const [balance, setBalance] = useState(String(debt.currentBalance));
  const [isActive, setIsActive] = useState(debt.isActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Submits a correction rather than recording a payment. */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ originalBalance: Number(originalBalance.replace(/,/g, '')), currentBalance: Number(balance.replace(/,/g, '')), isActive }, reason);
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to correct this record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-gray-950/50 sm:items-center sm:justify-center sm:p-4" role="presentation">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="debt-correction-title" className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="debt-correction-title" className="text-lg font-bold text-gray-900">Correct {debt.name}</h2><p className="mt-1 text-xs leading-relaxed text-gray-500">This creates an audit log. It does not add or change a payment.</p></div><button type="button" onClick={onClose} aria-label="Close correction form" className="min-h-11 min-w-11 rounded-lg text-lg text-gray-500">×</button></div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="block text-sm font-medium text-gray-700">Original balance<input type="text" inputMode="decimal" required value={originalBalance} onChange={event => setOriginalBalance(event.target.value.replace(/[^0-9.]/g, ''))} className="mt-1.5 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" /></label><label className="block text-sm font-medium text-gray-700">Current balance<input type="text" inputMode="decimal" required value={balance} onChange={event => setBalance(event.target.value.replace(/[^0-9.]/g, ''))} className="mt-1.5 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" /></label></div>
        <fieldset className="mt-4"><legend className="text-sm font-medium text-gray-700">Status</legend><div className="mt-1.5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setIsActive(true)} aria-pressed={isActive} className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${isActive ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}>Active</button><button type="button" onClick={() => { setIsActive(false); setBalance('0'); }} aria-pressed={!isActive} className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${!isActive ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-600'}`}>Paid off</button></div></fieldset>
        <p className="mt-2 text-xs text-gray-500">Stored original balance: {formatDebtUsd(debt.originalBalance)}. Marking paid off sets the current balance to $0.</p>
        <label className="mt-4 block text-sm font-medium text-gray-700">Why is this correction needed?<textarea required minLength={DEBT_CORRECTION_MIN_REASON_LENGTH} value={reason} onChange={event => setReason(event.target.value)} placeholder="Describe the record error" className="mt-1.5 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
        <p className="mt-1 text-xs text-gray-500">At least {DEBT_CORRECTION_MIN_REASON_LENGTH} characters. This reason is retained in the audit log.</p>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex gap-2"><button type="submit" disabled={saving} className="min-h-11 flex-1 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save correction'}</button><button type="button" onClick={onClose} className="min-h-11 rounded-lg px-4 text-sm font-medium text-gray-600">Cancel</button></div>
      </form>
    </div>
  );
}

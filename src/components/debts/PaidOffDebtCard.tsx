import type { DebtRecord } from '@/app/lib/debtRecords';
import { formatDebtDate, formatDebtUsd } from '@/app/lib/debtDisplay';

interface PaidOffDebtCardProps { debt: DebtRecord; onCorrect: (debt: DebtRecord) => void; }

/** Renders a paid-off debt while preserving its audit-correction entry point. */
export function PaidOffDebtCard({ debt, onCorrect }: PaidOffDebtCardProps) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white px-5 py-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-gray-700">{debt.name}</p><p className="mt-0.5 text-[10px] text-gray-400">{debt.paidOffAt ? `Paid off ${formatDebtDate(debt.paidOffAt)}` : 'Paid off'} · {formatDebtUsd(debt.currentBalance)} balance</p></div><svg className="mt-1 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>
      <button type="button" onClick={() => onCorrect(debt)} className="mt-2 min-h-11 w-full rounded-lg text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-4">Correct this record</button>
    </article>
  );
}

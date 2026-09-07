'use client';

import { useEffect, useState } from 'react';

export interface NetWorthValues {
  cash: number;
  investments: number;
  totalDebt: number;
}

interface NetWorthCheckInFormProps {
  initialValues: NetWorthValues;
  submitting: boolean;
  onSubmit: (values: NetWorthValues) => Promise<void>;
}

const CURRENCY_FIELDS: { key: keyof NetWorthValues; label: string; helper: string }[] = [
  { key: 'cash', label: 'Cash', helper: 'Checking, savings, and cash equivalents.' },
  { key: 'investments', label: 'Investments', helper: 'Retirement and taxable investment accounts.' },
  { key: 'totalDebt', label: 'Total debt', helper: 'Mortgage, loans, and credit cards combined.' },
];

function parseCurrency(value: string): number {
  return Number(value.replace(/[^0-9.-]/g, '')) || 0;
}

function formatCurrencyInput(value: number): string {
  return value > 0 ? Math.round(value).toLocaleString('en-US') : '';
}

/** Collects a single manual net-worth check-in from the user. */
export function NetWorthCheckInForm({
  initialValues,
  submitting,
  onSubmit,
}: NetWorthCheckInFormProps) {
  const [values, setValues] = useState<Record<keyof NetWorthValues, string>>({
    cash: formatCurrencyInput(initialValues.cash),
    investments: formatCurrencyInput(initialValues.investments),
    totalDebt: formatCurrencyInput(initialValues.totalDebt),
  });

  useEffect(() => {
    setValues({
      cash: formatCurrencyInput(initialValues.cash),
      investments: formatCurrencyInput(initialValues.investments),
      totalDebt: formatCurrencyInput(initialValues.totalDebt),
    });
  }, [initialValues.cash, initialValues.investments, initialValues.totalDebt]);

  const netWorth = parseCurrency(values.cash) + parseCurrency(values.investments) - parseCurrency(values.totalDebt);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          cash: parseCurrency(values.cash),
          investments: parseCurrency(values.investments),
          totalDebt: parseCurrency(values.totalDebt),
        });
      }}
      className="space-y-4"
    >
      {CURRENCY_FIELDS.map((field) => (
        <label key={field.key} className="block">
          <span className="text-sm font-semibold text-gray-800">{field.label}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{field.helper}</span>
          <span className="relative mt-2 block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={values[field.key]}
              onChange={(event) => setValues(current => ({ ...current, [field.key]: event.target.value }))}
              onBlur={() => setValues(current => ({
                ...current,
                [field.key]: formatCurrencyInput(parseCurrency(current[field.key])),
              }))}
              placeholder="0"
              className="w-full rounded-xl border border-gray-200 py-3 pl-7 pr-3 text-base text-gray-900 tabular-nums outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </span>
        </label>
      ))}

      <div className="rounded-xl bg-emerald-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Calculated net worth</p>
        <p className="mt-1 text-2xl font-bold text-emerald-900 tabular-nums">
          ${Math.round(netWorth).toLocaleString('en-US')}
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitting ? 'Saving check-in…' : 'Save today’s check-in'}
      </button>
    </form>
  );
}

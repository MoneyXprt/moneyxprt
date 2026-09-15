'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';
import { listDebtRecords, type DebtRecord } from '@/app/lib/debtRecords';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

interface ReviewSection { number: number; name: string; summary: string; }

/** Formats a stored dollar value without Audit form rounding. */
function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

/** Builds the five snapshot-backed review rows from exact persisted values. */
function snapshotSections(snapshot: FinancialSnapshot): ReviewSection[] {
  const spouse = snapshot.spouseWorks ? ` • spouse income ${money(snapshot.spouseW2Income + snapshot.spouseBusinessNetProfit)}` : '';
  const business = snapshot.hasBusinessEntity ? ' • business on file' : '';
  return [
    { number: 1, name: 'Income', summary: `${money(snapshot.w2Income)} salary • ${money(snapshot.bonusIncome)} bonus${spouse}` },
    { number: 2, name: 'Tax Situation', summary: `${snapshot.filingStatus.toUpperCase()} • ${snapshot.state} • ${money(snapshot.currentTaxPaid)} paid last year${business}` },
    { number: 3, name: 'Balance Sheet', summary: `${money(snapshot.primaryResidenceValue)} home • ${money(snapshot.retirementBalance)} retirement • ${money(snapshot.taxableBrokerageBalance)} brokerage` },
    { number: 5, name: 'Cash Flow', summary: `${money(snapshot.essentialMonthlySpend)} essential + ${money(snapshot.discretionaryMonthlySpend)} discretionary each month` },
    { number: 6, name: 'Household', summary: `${snapshot.dependentsUnder18} dependents under 18${snapshot.spouseWorks ? ` • spouse ${snapshot.spouseHoursPerWeekInBusiness} hrs/wk` : ''}` },
  ];
}

/** Formats a live debt list for the Liabilities review row. */
function debtSummary(debts: readonly DebtRecord[]): string {
  if (debts.length === 0) return 'No active debts tracked.';
  return debts.map((debt) => `${debt.name}: ${money(debt.currentBalance)} at ${debt.interestRate.toFixed(2)}%`).join(' • ');
}

/** Displays current Audit values and links each section to its isolated edit mode. */
export default function AuditReviewPage() {
  const [sections, setSections] = useState<ReviewSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const client = getBrowserSupabaseClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) throw new Error('Sign in to review your Audit information.');
        const [snapshot, debts] = await Promise.all([
          getLatestSnapshot(),
          listDebtRecords(user.id),
        ]);
        if (!snapshot) throw new Error('Complete your financial snapshot before reviewing it.');
        const rows = snapshotSections(snapshot);
        rows.splice(3, 0, { number: 4, name: 'Liabilities', summary: debtSummary(debts.active) });
        setSections(rows);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load your Audit review.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6"><div className="mx-auto max-w-2xl"><Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-700">← Dashboard</Link><h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Review &amp; Update</h1><p className="mt-2 text-sm leading-relaxed text-gray-500">Review the information shaping your plan. Edit only the section you need.</p>{loading && <div className="mt-8 space-y-3">{[1, 2, 3, 4, 5, 6].map((index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}</div>}{error && <div role="alert" className="mt-8 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}<Link href="/dashboard/audit" className="mt-3 flex min-h-11 items-center font-semibold underline">Open Audit →</Link></div>}{!loading && !error && <div className="mt-8 space-y-3">{sections.map((section) => <section key={section.number} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-bold text-gray-900">{section.name}</h2><p className="mt-1 text-sm leading-relaxed text-gray-500">{section.summary}</p></div><Link href={`/dashboard/audit?section=${section.number}&mode=edit`} className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-emerald-700 px-4 text-sm font-semibold text-emerald-800">Edit</Link></div></section>)}</div>}</div></main>;
}

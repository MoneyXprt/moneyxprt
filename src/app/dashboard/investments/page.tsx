'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { calculateReturnComparison, type InvestmentCheckIn } from '@/app/lib/investmentPerformance';
import { listInvestmentCheckIns, saveInvestmentCheckIn } from '@/app/lib/investmentCheckinsRepository';

function money(value: number): string { return `$${Math.round(value).toLocaleString('en-US')}`; }
function percent(value: number | null): string { return value === null ? '—' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function amount(value: string): number { return Number(value.replace(/[^0-9.-]/g, '')) || 0; }

/** Tracks manual portfolio check-ins against the S&P 500 price index. */
export default function InvestmentsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkIns, setCheckIns] = useState<InvestmentCheckIn[]>([]);
  const [value, setValue] = useState(''); const [contributions, setContributions] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<{ start: number; end: number } | null>(null);

  const load = useCallback(async (userId: string, accessToken: string) => {
    setLoading(true); setError(null);
    try {
      const rows = await listInvestmentCheckIns(getBrowserSupabaseClient(), userId); setCheckIns(rows);
      const latest = rows.at(-1); if (latest) { setValue(String(Math.round(latest.portfolioValue))); setContributions(String(Math.round(latest.cumulativeContributions))); }
      if (rows.length > 1) {
        const response = await fetch(`/api/market/sp500?start=${rows[0].observedOn}&end=${rows.at(-1)!.observedOn}`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (response.ok) setBenchmark(await response.json() as { start: number; end: number });
      }
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load investment tracking.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const client = getBrowserSupabaseClient(); client.auth.getSession().then(({ data: { session: current } }) => { setSession(current); if (current) void load(current.user.id, current.access_token); else setLoading(false); }); }, [load]);
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!session) return; setSaving(true); setError(null); try { await saveInvestmentCheckIn(getBrowserSupabaseClient(), session.user.id, amount(value), amount(contributions), today()); await load(session.user.id, session.access_token); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not save investment check-in.'); } finally { setSaving(false); } };
  const comparison = calculateReturnComparison(checkIns, benchmark?.start ?? null, benchmark?.end ?? null);
  if (loading) return <div className="min-h-screen bg-gray-50" />;
  if (!session) return <div className="min-h-screen bg-gray-50 p-12 text-center text-sm text-gray-600">Sign in from <Link href="/dashboard" className="font-semibold text-emerald-700 underline">your dashboard</Link> to track investments.</div>;
  return <main className="min-h-screen bg-gray-50 px-4 py-8 pb-24"><div className="mx-auto max-w-lg space-y-5"><Link href="/dashboard/actuals" className="text-sm font-semibold text-emerald-700">← Track</Link><div><h1 className="text-2xl font-bold text-gray-900">Investment returns</h1><p className="mt-1 text-sm text-gray-500">Compare your portfolio’s cash-flow-adjusted return with the S&P 500 price index.</p></div>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="grid grid-cols-3 gap-3">{[['Portfolio', comparison.portfolioReturn], ['S&P 500', comparison.benchmarkReturn], ['Difference', comparison.difference]].map(([label, result]) => <div key={String(label)} className="rounded-xl bg-white p-3 shadow-sm"><p className="text-[10px] font-semibold uppercase text-gray-400">{label}</p><p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{percent(result as number | null)}</p></div>)}</div>{checkIns.length < 2 && <aside className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-5 text-emerald-900"><strong>{checkIns.length === 0 ? 'Start your baseline.' : 'One more check-in to compare.'}</strong><p className="mt-1">Record today’s value and total contributions. Add another check-in later to see your cash-flow-adjusted return beside the S&amp;P 500.</p></aside>}<form onSubmit={save} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-gray-900">Today’s portfolio check-in</h2><input aria-label="Portfolio value" required inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} placeholder="Portfolio value" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" /><input aria-label="Cumulative contributions" required inputMode="decimal" value={contributions} onChange={event => setContributions(event.target.value)} placeholder="Cumulative contributions" className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm" /><button disabled={saving} className="min-h-11 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save check-in'}</button></form><section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-gray-900">Recent check-ins</h2><div className="mt-3 divide-y divide-gray-100">{checkIns.slice(-5).reverse().map(row => <div key={row.id} className="flex justify-between py-2 text-sm"><span className="text-gray-500">{row.observedOn}</span><span className="font-semibold tabular-nums">{money(row.portfolioValue)}</span></div>)}{!checkIns.length && <p className="text-sm text-gray-500">Save two check-ins to see return comparison.</p>}</div><p className="mt-4 text-[11px] leading-relaxed text-gray-400">S&P 500 comparison is price return only; it excludes dividends, taxes, and fees.</p></section></div></main>;
}

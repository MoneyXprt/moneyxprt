'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

interface Summary { netWorth: number | null; goals: number; investmentCheckIns: number; plannedEvents: number; }

/** Provides one short monthly review across MoneyXprt's tracking tools. */
export default function MonthlyCheckInPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => { const client = getBrowserSupabaseClient(); client.auth.getUser().then(async ({ data: { user } }) => { if (!user) return; const [net, goals, investments, cash] = await Promise.all([
    client.from('financial_observations').select('value').eq('user_id', user.id).eq('metric', 'net_worth').order('observed_on', { ascending: false }).limit(1).maybeSingle(),
    client.from('goal_buckets').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    client.from('investment_checkins').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    client.from('cash_flow_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]); setSummary({ netWorth: net.data ? Number(net.data.value) : null, goals: goals.count ?? 0, investmentCheckIns: investments.count ?? 0, plannedEvents: cash.count ?? 0 }); }); }, []);
  if (!summary) return <div className="min-h-screen bg-gray-50"/>;
  const next = summary.plannedEvents === 0 ? ['Plan your cash flow', '/dashboard/cash-flow'] : summary.netWorth === null ? ['Record your net worth', '/dashboard/net-worth'] : ['Review your execution plan', '/dashboard/execute'];
  return <main className="min-h-screen bg-gray-50 px-4 py-8 pb-24"><div className="mx-auto max-w-lg space-y-5"><Link href="/dashboard" className="text-sm font-semibold text-emerald-700">← Home</Link><div><h1 className="text-2xl font-bold">Monthly check-in</h1><p className="mt-1 text-sm text-gray-500">A calm 5-minute review of what changed and what matters next.</p></div><section className="grid grid-cols-2 gap-3">{[['Net worth',summary.netWorth===null?'Not recorded':`$${Math.round(summary.netWorth).toLocaleString()}`],['Goal buckets',String(summary.goals)],['Investment check-ins',String(summary.investmentCheckIns)],['Cash-flow events',String(summary.plannedEvents)]].map(([label,value])=><div key={label} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-[11px] uppercase text-gray-400">{label}</p><p className="mt-1 font-bold text-gray-900">{value}</p></div>)}</section><section className="rounded-2xl bg-emerald-50 p-5"><p className="text-xs font-semibold uppercase text-emerald-700">This month’s next step</p><h2 className="mt-1 text-lg font-bold text-emerald-950">{next[0]}</h2><Link href={next[1]} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white">Continue →</Link></section><p className="text-xs leading-relaxed text-gray-500">Update only what changed. A consistent monthly rhythm is more useful than a perfect spreadsheet.</p></div></main>;
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { TAX_DISCLAIMER_TEXT } from '@/app/lib/legal/taxDisclaimer';
import type { Session } from '@supabase/supabase-js';
import { TaxDisclaimerBanner } from '@/components/TaxDisclaimerBanner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportStats {
  implementedCount: number;
  totalSavings: number;
  repsHoursYTD: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CpaReportPage() {
  const [session, setSession]   = useState<Session | null>(null);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<ReportStats | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadStats(s.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  async function loadStats(userId: string) {
    const sb = getBrowserSupabaseClient();
    const currentYear = new Date().getFullYear();

    const [actionsResult, repsResult] = await Promise.all([
      sb
        .from('execution_actions')
        .select('estimated_annual_value')
        .eq('user_id', userId)
        .eq('completed', true)
        .not('strategy_id', 'is', null),
      sb
        .from('material_participation_logs')
        .select('hours_logged')
        .eq('user_id', userId)
        .gte('date', `${currentYear}-01-01`)
        .lt('date', `${currentYear + 1}-01-01`),
    ]);

    const completedActions = actionsResult.data ?? [];
    const repsLogs         = repsResult.data ?? [];

    setStats({
      implementedCount: completedActions.length,
      totalSavings:     completedActions.reduce((s, a) => s + Number(a.estimated_annual_value ?? 0), 0),
      repsHoursYTD:     repsLogs.reduce((s, l) => s + Number(l.hours_logged ?? 0), 0),
    });
    setLoading(false);
  }

  async function generateReport() {
    if (!session) return;
    setGenerating(true);
    setGenError(null);

    try {
      const { data: { session: freshSession } } = await getBrowserSupabaseClient().auth.getSession();
      if (!freshSession) throw new Error('Not signed in — please refresh and try again.');

      const response = await fetch('/api/generate-cpa-report', {
        method: 'POST',
        headers: { Authorization: `Bearer ${freshSession.access_token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(err.error ?? `Server error ${response.status}`);
      }

      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `cpa-report-${new Date().getFullYear()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sign in to generate your CPA report.</p>
          <Link href="/dashboard" className="text-emerald-600 font-semibold hover:underline">← Dashboard</Link>
        </div>
      </div>
    );
  }

  const hasStrategies = (stats?.implementedCount ?? 0) > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">CPA Report</p>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">Year-end summary for your tax professional</p>
          </div>
          <Link
            href="/dashboard/settings"
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            ← Settings
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Description */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Your CPA Report</h1>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
            A clean summary of your implemented strategies, ready to hand to your tax professional.
            Written in CPA language — IRC citations, documentation requirements, and your REPS hour log.
          </p>
        </div>

        {/* Preview card */}
        {stats && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-900">What&apos;s in this report</p>
            </div>
            <div className="divide-y divide-gray-50">
              <div className="flex items-center justify-between px-5 py-3.5">
                <p className="text-sm text-gray-700">Strategies implemented</p>
                <p className={`text-sm font-bold tabular-nums ${hasStrategies ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {stats.implementedCount}
                </p>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <p className="text-sm text-gray-700">Estimated annual savings documented</p>
                <p className={`text-sm font-bold tabular-nums ${stats.totalSavings > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {stats.totalSavings > 0 ? fmt(stats.totalSavings) + '/yr' : '—'}
                </p>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <p className="text-sm text-gray-700">REPS hours logged this year</p>
                <p className={`text-sm font-bold tabular-nums ${stats.repsHoursYTD > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                  {stats.repsHoursYTD > 0 ? stats.repsHoursYTD.toFixed(1) + ' hrs' : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CPA note */}
        <div className="bg-sky-50 rounded-xl border border-sky-100 px-4 py-3.5">
          <p className="text-xs font-semibold text-sky-900 mb-0.5">For your tax professional</p>
          <p className="text-xs text-sky-700 leading-relaxed">
            This report includes IRC citations, documentation checklists, and your contemporaneous REPS
            hour log. Share it directly with your CPA before filing. MoneyXprt is educational software —
            all strategies require professional review.
          </p>
        </div>

        <TaxDisclaimerBanner text={TAX_DISCLAIMER_TEXT} />

        {/* Empty state */}
        {!hasStrategies && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-8 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-1.5">No strategies marked as implemented yet</p>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed max-w-xs mx-auto">
              Mark at least one strategy complete in your execution plan to generate a CPA report.
            </p>
            <Link
              href="/dashboard/execute"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1B3A2D] text-white text-sm font-semibold hover:bg-[#152d22] transition"
            >
              Go to execution plan →
            </Link>
          </div>
        )}

        {/* Generate button */}
        {hasStrategies && (
          <div className="space-y-3">
            <button
              onClick={generateReport}
              disabled={generating}
              className="w-full py-4 rounded-2xl bg-[#1B3A2D] text-white font-bold text-base hover:bg-[#152d22] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition flex items-center justify-center gap-2.5"
            >
              {generating ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating PDF…
                </>
              ) : (
                'Generate PDF Report'
              )}
            </button>

            {genError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs text-red-700 leading-relaxed">
                {genError}
              </div>
            )}

            <p className="text-center text-[11px] text-gray-400">
              PDF is generated on demand — no data is stored externally.
              Generation typically takes 2–4 seconds.
            </p>
          </div>
        )}

        <div className="pb-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center text-sm text-gray-400 hover:text-gray-700 transition py-2 gap-1"
          >
            ← Back to dashboard
          </Link>
        </div>

      </main>
    </div>
  );
}

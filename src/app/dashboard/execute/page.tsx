'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Tooltip } from '@/components/Tooltip';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { getLatestSnapshot } from '@/app/lib/snapshots';
import { loadTaxConstantsByYear } from '@/app/lib/taxConstantsByYearRepository';
import { generateActions, saveActions } from '@/app/lib/actionGenerator';
import type { ExecutionAction } from '@/app/lib/actionGenerator';
import { computeRepsRelevance } from '@/app/lib/planGenerator';
import type { GeneratedPlan, AssetRoadmapRow } from '@/app/lib/planGenerator';
import type { BonusPlan } from '@/app/lib/deployableCapital';
import type { FinancialPhase } from '@/app/lib/financialPhase';
import type { Session } from '@supabase/supabase-js';
import { LifeEventSuccessToast } from '@/components/LifeEventSuccessToast';
import { TaxDisclaimerBanner } from '@/components/TaxDisclaimerBanner';
import { TAX_DISCLAIMER_TEXT } from '@/app/lib/legal/taxDisclaimer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function isPartnerAction(action: ExecutionAction) {
  return (
    action.strategy_id === 'reps' ||
    action.title.toLowerCase().includes('spouse')
  );
}

// This is a task reminder, not a data-entry form — clicking through takes the user
// straight to the logging form (not the Actuals hub) since that's the one thing this
// reminder is about.
function isBonusLogAction(action: ExecutionAction) {
  return action.title === "Log this year's bonus payment";
}

// ─── Milestone overlay (This Year completions) ────────────────────────────────

function MilestoneOverlay({
  action,
  visionText,
  onDismiss,
}: {
  action: ExecutionAction;
  visionText: string | null;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show  = setTimeout(() => setVisible(true), 40);
    const close = setTimeout(onDismiss, 4000);
    return () => { clearTimeout(show); clearTimeout(close); };
  }, [onDismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#1B3A2D] flex flex-col items-center justify-center px-8 text-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onDismiss}
    >
      <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-[0.3em] mb-6">
        Milestone Complete
      </p>
      <p className="text-white text-2xl font-bold leading-snug mb-4 max-w-xs">
        {action.title}
      </p>
      <p className="text-emerald-400 text-base mb-8">
        You&apos;re building something real.
      </p>
      {visionText && (
        <p className="text-white/50 italic text-sm leading-relaxed max-w-xs mb-8">
          &ldquo;{visionText}&rdquo;
        </p>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="px-6 py-3 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition"
      >
        Keep going →
      </button>
    </div>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({
  action,
  onToggle,
  justCompleted,
  currentUserId,
  isPartnerView,
  freedomYear,
}: {
  action: ExecutionAction;
  onToggle: () => void;
  justCompleted: boolean;
  currentUserId: string;
  isPartnerView: boolean;
  freedomYear: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const long = (action.description?.length ?? 0) > 120;
  const showPartnerBadge = isPartnerAction(action);
  const completedByMe      = action.completed && action.completed_by === currentUserId;
  const completedByPartner = action.completed && action.completed_by !== currentUserId && !!action.completed_by;

  return (
    <div
      className={`rounded-xl border shadow-sm p-4 transition-all duration-300 ${
        action.completed ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={action.completed ? 'Mark incomplete' : 'Mark complete'}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all active:scale-90 ${
            action.completed
              ? 'border-emerald-500 bg-emerald-500'
              : 'border-gray-300 hover:border-emerald-400 active:border-emerald-500'
          }`}
        >
          {action.completed && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className={`text-sm font-semibold leading-snug ${action.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {action.title}
            </p>
            {showPartnerBadge && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wide shrink-0">
                Partner
              </span>
            )}
          </div>

          {action.description && (
            <>
              <p className={`mt-1 text-xs text-gray-500 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
                {action.description}
              </p>
              {long && (
                <button
                  type="button"
                  onClick={() => setExpanded(e => !e)}
                  className="mt-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )}

          {!action.completed && (action.estimated_annual_value > 0 || action.estimated_months_saved > 0) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {action.estimated_annual_value > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold tabular-nums">
                  Est. {fmt(action.estimated_annual_value)}/yr
                  <Tooltip content="This is an estimate, not a realized result. Confirm eligibility, timing, and documentation before relying on it in your plan." />
                </span>
              )}
              {action.estimated_months_saved > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-[10px] font-bold">
                  {action.estimated_months_saved.toFixed(1)} mo closer
                </span>
              )}
            </div>
          )}

          {action.completed && !justCompleted && (
            <p className="mt-1.5 text-[10px] text-gray-400">
              {completedByMe
                ? 'Checked off by you'
                : completedByPartner
                  ? isPartnerView
                    ? 'Checked off by your primary account'
                    : 'Checked off by your partner'
                  : 'Checked off'}
            </p>
          )}

          {justCompleted && (
            <p className="mt-2 text-xs font-semibold text-emerald-600 animate-fade-in">
              ✓ Done.{' '}
              {freedomYear
                ? `Your freedom in ${freedomYear} just got more certain.`
                : 'Your plan just got stronger.'}
              {action.estimated_months_saved > 0
                ? ` This moves your freedom date ${action.estimated_months_saved.toFixed(1)} month${action.estimated_months_saved !== 1 ? 's' : ''} closer.`
                : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Milestone card (this_year) ───────────────────────────────────────────────

function MilestoneCard({
  action,
  onToggle,
  justCompleted,
  currentUserId,
  isPartnerView,
}: {
  action: ExecutionAction;
  onToggle: () => void;
  justCompleted: boolean;
  currentUserId: string;
  isPartnerView: boolean;
}) {
  const showPartnerBadge  = isPartnerAction(action);
  const completedByMe     = action.completed && action.completed_by === currentUserId;
  const completedByPartner = action.completed && action.completed_by !== currentUserId && !!action.completed_by;

  return (
    <div
      className={`rounded-xl border shadow-sm px-4 py-5 transition-all duration-300 ${
        action.completed ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={action.completed ? 'Mark incomplete' : 'Mark complete'}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all active:scale-90 ${
            action.completed
              ? 'border-emerald-500 bg-emerald-500'
              : 'border-gray-300 hover:border-emerald-400'
          }`}
        >
          {action.completed && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className={`text-sm font-bold leading-snug ${action.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {action.title}
            </p>
            {showPartnerBadge && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold uppercase tracking-wide shrink-0">
                Partner
              </span>
            )}
          </div>

          {action.description && (
            <p className="mt-1 text-xs text-gray-500 leading-relaxed line-clamp-3">
              {action.description}
            </p>
          )}

          {action.estimated_months_saved > 0 && !action.completed && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">
              Completing this moves your freedom date {action.estimated_months_saved.toFixed(1)} month{action.estimated_months_saved !== 1 ? 's' : ''} earlier
            </p>
          )}

          {action.due_date && (
            <p className="mt-1.5 text-[10px] text-gray-400 tabular-nums">
              Target: {new Date(action.due_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
            </p>
          )}

          {isBonusLogAction(action) && !action.completed && (
            <Link
              href="/dashboard/bonus-log"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Log now
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          {action.completed && !justCompleted && (
            <p className="mt-1.5 text-[10px] text-gray-400">
              {completedByMe
                ? 'Checked off by you'
                : completedByPartner
                  ? isPartnerView
                    ? 'Checked off by your primary account'
                    : 'Checked off by your partner'
                  : 'Checked off'}
            </p>
          )}

          {/* Full-screen overlay fires separately; no inline celebration for year milestones */}
        </div>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  icon,
  progress,
}: {
  title: string;
  icon: React.ReactNode;
  progress?: { done: number; total: number };
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h2>
      </div>
      {progress && (
        <span className="text-xs text-gray-400 font-medium tabular-nums">
          {progress.done} of {progress.total}
        </span>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="h-16 rounded-xl bg-gray-100 animate-pulse" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExecutePage() {
  const [session, setSession]               = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loading, setLoading]               = useState(true);
  const [generating, setGenerating]         = useState(false);
  const [noPlan, setNoPlan]                 = useState(false);
  const [actions, setActions]               = useState<ExecutionAction[]>([]);
  const [freedomYear, setFreedomYear]       = useState<number | null>(null);
  const [justCompleted, setJustCompleted]   = useState<Set<string>>(new Set());
  const [visionText, setVisionText]         = useState<string | null>(null);
  const [milestoneOverlay, setMilestoneOverlay] = useState<ExecutionAction | null>(null);
  // Same 2-year-window check gating the REPS Hours widget/QuickActions tile on Home.
  const [repsRelevant, setRepsRelevant]     = useState(false);
  // Partner context
  const [isPartnerView, setIsPartnerView]   = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  const dismissOverlay = useCallback(() => setMilestoneOverlay(null), []);

  // Shared by the initial auto-generate path and the manual "Refresh actions" button —
  // fetches fresh plan/snapshot/REPS-hours/bonusPlan data, regenerates via
  // generateActions, and persists via saveActions' existing delete-and-reupsert-by-title
  // merge logic. userId here is always the data owner (never a partner's own id — see
  // callers), since a partner has no plan/snapshot of their own to regenerate from.
  async function regenerateActions(userId: string): Promise<void> {
    const sb = getBrowserSupabaseClient();
    const currentYear = new Date().getFullYear();

    const [planResult, snapshotResult, repsResult, bonusPlanResult, phaseResult, strategyEvaluationContext] = await Promise.all([
      sb
        .from('generated_plans')
        .select('freedom_gap, phases, tax_strategy_stack, asset_roadmap, deployable_capital_per_year')
        .eq('user_id', userId)
        .eq('is_current', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      getLatestSnapshot(),
      sb
        .from('material_participation_logs')
        .select('hours_logged')
        .eq('user_id', userId)
        .gte('date', `${currentYear}-01-01`)
        .lt('date', `${currentYear + 1}-01-01`),
      sb
        .from('bonus_plan')
        .select('frequency, plan_amount, payment_month')
        .eq('user_id', userId)
        .maybeSingle(),
      sb
        .from('financial_phase_status')
        .select('phase')
        .eq('user_id', userId)
        .maybeSingle(),
      loadTaxConstantsByYear(currentYear),
    ]);

    if (!planResult.data || !snapshotResult) {
      setNoPlan(true);
      return;
    }

    const row = planResult.data;
    const repsHours = (repsResult.data ?? []).reduce(
      (s: number, r: { hours_logged: number }) => s + Number(r.hours_logged ?? 0),
      0,
    );

    const plan: GeneratedPlan = {
      freedomGap:               row.freedom_gap as GeneratedPlan['freedomGap'],
      phases:                   row.phases as GeneratedPlan['phases'],
      taxStrategyStack:         row.tax_strategy_stack as GeneratedPlan['taxStrategyStack'],
      assetRoadmap:             row.asset_roadmap as GeneratedPlan['assetRoadmap'],
      deployableCapitalPerYear: Number(row.deployable_capital_per_year),
      aiNarrative:              null,
    };

    setFreedomYear(plan.freedomGap.projectedFreedomYear);
    setRepsRelevant(computeRepsRelevance(snapshotResult.currentlyOwnsRental, plan.assetRoadmap).relevant);

    const bonusPlanRow = bonusPlanResult.data;
    const bonusPlan: BonusPlan | null = bonusPlanRow ? {
      frequency:    bonusPlanRow.frequency as BonusPlan['frequency'],
      planAmount:   Number(bonusPlanRow.plan_amount),
      paymentMonth: bonusPlanRow.payment_month,
    } : null;

    const financialPhase = (phaseResult.data?.phase as FinancialPhase | undefined) ?? null;
    const generated = generateActions(plan, snapshotResult, repsHours, bonusPlan, financialPhase, strategyEvaluationContext);
    try {
      await saveActions(generated, userId);
    } catch (e) {
      console.warn('saveActions failed:', e);
    }

    const { data: saved } = await sb
      .from('execution_actions')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');

    setActions((saved ?? []) as ExecutionAction[]);
  }

  async function handleRefreshActions() {
    if (!session || isPartnerView || refreshing) return;
    setRefreshing(true);
    try {
      await regenerateActions(session.user.id);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
      if (s) loadData(s.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData(userId: string) {
    setLoading(true);
    const sb = getBrowserSupabaseClient();

    // Detect partner relationship
    const { data: primaryProfile } = await sb
      .from('freedom_profiles')
      .select('user_id')
      .eq('partner_user_id', userId)
      .eq('partner_accepted', true)
      .maybeSingle();

    const primaryUserId = primaryProfile?.user_id ?? userId;
    const asPartner = !!primaryProfile;
    setIsPartnerView(asPartner);

    // Vision text (fire async — don't block main load)
    sb.from('freedom_profiles')
      .select('vision_text')
      .eq('user_id', primaryUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setVisionText(data?.vision_text ?? null));

    const { data: actionRows } = await sb
      .from('execution_actions')
      .select('*')
      .eq('user_id', primaryUserId)
      .order('sort_order');

    if (actionRows && actionRows.length > 0) {
      setActions(actionRows as ExecutionAction[]);
      const [{ data: planRow }, { data: snapshotRow }] = await Promise.all([
        sb
          .from('generated_plans')
          .select('freedom_gap, asset_roadmap')
          .eq('user_id', primaryUserId)
          .eq('is_current', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from('financial_snapshots')
          .select('currently_owns_rental')
          .eq('user_id', primaryUserId)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (planRow?.freedom_gap) {
        setFreedomYear((planRow.freedom_gap as GeneratedPlan['freedomGap']).projectedFreedomYear);
      }
      setRepsRelevant(computeRepsRelevance(
        !!snapshotRow?.currently_owns_rental,
        (planRow?.asset_roadmap as AssetRoadmapRow[] | undefined) ?? [],
      ).relevant);
      setLoading(false);
      return;
    }

    if (asPartner) {
      setNoPlan(true);
      setLoading(false);
      return;
    }

    // Self — auto-generate from latest plan
    setGenerating(true);
    await regenerateActions(userId);
    setLoading(false);
    setGenerating(false);
  }

  async function toggleAction(id: string, currentCompleted: boolean) {
    if (!session) return;
    const nowCompleted  = !currentCompleted;
    const currentUserId = session.user.id;
    const action        = actions.find(a => a.id === id);

    // Optimistic update — runs before the DB write so the UI feels instant.
    setActions(prev =>
      prev.map(a =>
        a.id === id
          ? {
              ...a,
              completed:    nowCompleted,
              completed_at: nowCompleted ? new Date().toISOString() : null,
              completed_by: nowCompleted ? currentUserId : null,
            }
          : a,
      ),
    );

    if (nowCompleted) {
      if (action?.category !== 'this_year') {
        setJustCompleted(prev => new Set(prev).add(id));
        setTimeout(() => {
          setJustCompleted(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 3000);
      }
      if (action?.category === 'this_year') {
        setMilestoneOverlay(action);
      }
    }

    // ── Database write ────────────────────────────────────────────────────

    const payload = {
      completed:    nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
      completed_by: nowCompleted ? currentUserId : null,
    };

    const sb = getBrowserSupabaseClient();
    const { data, error } = await sb
      .from('execution_actions')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) {
      console.error('[toggleAction] update failed — rolling back optimistic UI:', error.message);
      // Roll back the optimistic update so the UI reflects actual DB state.
      setActions(prev =>
        prev.map(a =>
          a.id === id
            ? {
                ...a,
                completed:    currentCompleted,
                completed_at: currentCompleted ? a.completed_at : null,
                completed_by: currentCompleted ? a.completed_by : null,
              }
            : a,
        ),
      );
      return;
    }

    if (!data || data.length === 0) {
      // data: [] with error: null is Supabase's signature for a silent RLS block.
      // The UPDATE policy is missing — the write was rejected without an error.
      console.error(
        '[toggleAction] UPDATE returned 0 rows (id:', id, ').\n' +
        'This is a Supabase RLS silent block — the UPDATE policy is missing on execution_actions.\n' +
        'Fix: run in Supabase SQL editor:\n\n' +
        "  create policy \"Users can update their own execution actions\"\n" +
        '  on public.execution_actions for update\n' +
        '  using (auth.uid() = user_id)\n' +
        '  with check (auth.uid() = user_id);\n',
      );
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sign in to view your execution plan.</p>
          <Link href="/dashboard" className="text-emerald-600 font-semibold hover:underline">← Dashboard</Link>
        </div>
      </div>
    );
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const thisWeekActions    = actions.filter(a => a.category === 'this_week');
  const thisQuarterActions = actions.filter(a => a.category === 'this_quarter');
  const thisYearActions    = actions.filter(a => a.category === 'this_year');

  const completedCount   = actions.filter(a => a.completed).length;
  const totalCount       = actions.length;
  const activatedSavings = actions
    .filter(a => a.completed && a.estimated_annual_value > 0)
    .reduce((s, a) => s + a.estimated_annual_value, 0);
  const progressPct      = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const weekDone    = thisWeekActions.filter(a => a.completed).length;
  const quarterDone = thisQuarterActions.filter(a => a.completed).length;
  const currentUserId = session.user.id;

  // Estimated value attached to unfinished strategy-linked actions.
  const pendingEstimatedValue = actions
    .filter(a => !a.completed && (a.estimated_annual_value ?? 0) > 0 && a.strategy_id)
    .reduce((s, a) => s + (a.estimated_annual_value ?? 0), 0);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <LifeEventSuccessToast />
      {/* Milestone overlay — full-screen for This Year completions */}
      {milestoneOverlay && (
        <MilestoneOverlay
          action={milestoneOverlay}
          visionText={visionText}
          onDismiss={dismissOverlay}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">Your Execution Plan</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Every action you complete moves your freedom date closer.</p>
            </div>
            <div className="flex items-center gap-1">
              {!isPartnerView && (
                <button
                  onClick={handleRefreshActions}
                  disabled={refreshing || loading}
                  title="Refresh actions"
                  aria-label="Refresh actions"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
                >
                  <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => getBrowserSupabaseClient().auth.signOut()}
                className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          generating ? (
            <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center gap-4 text-center">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Your execution plan is being generated…</p>
            </div>
          ) : (
            <Skeleton />
          )
        ) : noPlan ? (
          <div className="max-w-lg mx-auto px-4 py-12 text-center">
            <p className="text-base font-semibold text-gray-700 mb-2">No plan found</p>
            <p className="text-sm text-gray-500 mb-6">
              {isPartnerView
                ? "Your partner hasn't generated their plan yet. Ask them to visit the Plan tab first."
                : 'Complete your freedom plan first to generate your execution checklist.'}
            </p>
            {!isPartnerView && (
              <Link href="/dashboard/plan" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
                Build my plan →
              </Link>
            )}
          </div>
        ) : (
          <main className="max-w-lg mx-auto px-4 pt-28 pb-24 space-y-6">

            {/* Partner banner */}
            {isPartnerView && (
              <div className="flex items-center gap-2.5 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 -mb-2">
                <span className="text-lg">🏠</span>
                <p className="text-xs text-purple-700 font-medium">
                  You&apos;re viewing your shared household plan. You can check off any action.
                </p>
              </div>
            )}

            {/* Progress summary */}
            <div className="sticky top-14 z-10 bg-[#1B3A2D] -mx-4 sm:mx-0 sm:rounded-xl px-5 py-4 text-white border-b border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap text-sm">
                  <span className="tabular-nums font-semibold">
                    {completedCount} of {totalCount} complete
                  </span>
                  {activatedSavings > 0 && (
                    <span className="text-[#C9A84C] font-bold tabular-nums">
                      Est. {fmt(activatedSavings)}/yr marked complete
                    </span>
                  )}
                  {freedomYear && (
                    <span className="text-emerald-300 font-semibold">
                      Freedom {freedomYear}
                    </span>
                  )}
                </div>
                <span className="text-emerald-400 text-xs font-medium">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/50 rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {pendingEstimatedValue > 0 && (
                <p className="text-amber-300 text-[10px] mt-2 leading-relaxed">
                  Up to {fmt(pendingEstimatedValue)}/year in estimated value remains to be validated and acted on.
                </p>
              )}
            </div>

            {pendingEstimatedValue > 0 && (
              <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs leading-relaxed text-sky-900">
                  <span className="font-semibold">Validate before you count it.</span>{' '}
                  Tax and income figures are planning estimates. Review eligibility and keep the required records with your CPA before treating a strategy as implemented.
                  <Link href="/dashboard/audit/results" className="ml-1 font-semibold text-sky-800 underline underline-offset-2">Review assumptions</Link>
                </p>
              </div>
            )}

            {actions.some(action => action.strategy_id !== null && action.estimated_annual_value > 0) && (
              <TaxDisclaimerBanner text={TAX_DISCLAIMER_TEXT} />
            )}

            {/* THIS WEEK */}
            {thisWeekActions.length > 0 && (
              <section>
                <SectionHeader
                  title="This Week"
                  icon={
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  progress={{ done: weekDone, total: thisWeekActions.length }}
                />
                <div className="space-y-3">
                  {thisWeekActions.map(action => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onToggle={() => toggleAction(action.id!, action.completed)}
                      justCompleted={justCompleted.has(action.id!)}
                      currentUserId={currentUserId}
                      isPartnerView={isPartnerView}
                      freedomYear={freedomYear}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* THIS QUARTER */}
            {thisQuarterActions.length > 0 && (
              <section>
                <SectionHeader
                  title="This Quarter"
                  icon={
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                  progress={{ done: quarterDone, total: thisQuarterActions.length }}
                />
                {thisQuarterActions.length > 1 && (
                  <div className="mb-3">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((quarterDone / thisQuarterActions.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {thisQuarterActions.map(action => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onToggle={() => toggleAction(action.id!, action.completed)}
                      justCompleted={justCompleted.has(action.id!)}
                      currentUserId={currentUserId}
                      isPartnerView={isPartnerView}
                      freedomYear={freedomYear}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* THIS YEAR */}
            {thisYearActions.length > 0 && (
              <section>
                <SectionHeader
                  title="This Year"
                  icon={
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                  }
                />
                <div className="space-y-3">
                  {thisYearActions.map(action => (
                    <MilestoneCard
                      key={action.id}
                      action={action}
                      onToggle={() => toggleAction(action.id!, action.completed)}
                      justCompleted={justCompleted.has(action.id!)}
                      currentUserId={currentUserId}
                      isPartnerView={isPartnerView}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* CPA report nudge — only when at least one action is completed */}
            {completedCount > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                <p className="text-sm font-bold text-gray-900 mb-0.5">Ready to hand this to your CPA?</p>
                <p className="text-xs text-gray-500 leading-relaxed mb-3.5">
                  Generate a clean PDF with IRC citations, documentation requirements, and your REPS hour
                  log — formatted for your tax professional.
                </p>
                <Link
                  href="/dashboard/cpa-report"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B3A2D] text-white text-xs font-semibold hover:bg-[#152d22] transition"
                >
                  Generate CPA report →
                </Link>
              </div>
            )}

            {/* Log hours link — same repsRelevant gate as Home's REPS Hours widget/tile */}
            {repsRelevant && (
              <div className="border-t border-gray-100 pt-4">
                <Link
                  href="/dashboard/logs"
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-700 transition py-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Log REPS hours →
                </Link>
              </div>
            )}

          </main>
        )}
      </div>
    </>
  );
}

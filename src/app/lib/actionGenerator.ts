/**
 * actionGenerator.ts
 * Pure generator (no side effects) + Supabase persistence helpers.
 */

import type { GeneratedPlan } from './planGenerator';
import type { FinancialSnapshot } from './strategies/types';
import type { BonusPlan } from './deployableCapital';
import { evaluateAll } from './strategies';
import { MINI_EMERGENCY_FUND_TARGET, type FinancialPhase } from './financialPhase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionAction {
  id?: string;
  user_id?: string;
  title: string;
  description: string | null;
  category: 'this_week' | 'this_quarter' | 'this_year';
  phase: number;
  strategy_id: string | null;
  estimated_annual_value: number;
  estimated_months_saved: number;
  completed: boolean;
  completed_at: string | null;
  due_date: string | null;
  sort_order: number;
  completed_by?: string | null;
  created_at?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function addDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function endOfYear(d: Date): string {
  return `${d.getFullYear()}-12-31`;
}

function endOfQuarter(d: Date): string {
  const qEnd = Math.floor(d.getMonth() / 3) * 3 + 2;
  const last = new Date(d.getFullYear(), qEnd + 1, 0);
  return last.toISOString().slice(0, 10);
}

function monthsSaved(annualValue: number, deployableCapPerYear: number): number {
  if (deployableCapPerYear <= 0 || annualValue <= 0) return 0;
  return Math.round((annualValue / deployableCapPerYear) * 12 * 10) / 10;
}

// ─── Strategy description map ─────────────────────────────────────────────────

const STRATEGY_DESCRIPTIONS: Record<string, (value: number) => string> = {
  'augusta-rule':      (v) => `Rent your home to your business for up to 14 days/year. Charge fair market rate (~$400/day). Your business deducts it; you receive it tax-free. Document with a written agenda and attendees list. Estimated savings: ${fmt(v)}/year.`,
  'solo-k':            (v) => `Your self-employment income qualifies you for a Solo 401(k). Open at Fidelity or Vanguard. Contribute up to the IRS limit before December 31 to capture this year's deduction. Estimated savings: ${fmt(v)}/year.`,
  'backdoor-roth':     (v) => `Make a non-deductible Traditional IRA contribution, then convert to Roth immediately. Tax-free growth forever. Deadline is April 15. Estimated savings: ${fmt(v)}/year.`,
  'hsa':               (v) => `Maximize your HSA contribution this year. Triple tax advantage: deductible going in, grows tax-free, tax-free out for medical expenses. Estimated savings: ${fmt(v)}/year.`,
  's-corp-election':   (v) => `Electing S-Corp reduces self-employment taxes on profit above a reasonable salary. File Form 2553 by March 15 for current-year effect. Work with your CPA on the right salary level. Estimated savings: ${fmt(v)}/year.`,
  'qbi':               (v) => `The 20% QBI deduction may apply to your qualified business income. Verify your business structure qualifies and that income is below phase-out thresholds. Estimated savings: ${fmt(v)}/year.`,
  'accountable-plan':  (v) => `Set up a formal accountable plan to reimburse business expenses tax-free through your entity. Common categories: home office, phone, vehicle, professional development. Document with receipts. Estimated savings: ${fmt(v)}/year.`,
  'depreciation':      (v) => `Cost segregation and bonus depreciation on your rental can create paper losses that offset W-2 income. Requires a qualified CPA to perform the study. Estimated savings: ${fmt(v)}/year.`,
  'hire-kids':         (v) => `Pay your children (ages 7–17) for legitimate work in your business. Up to the standard deduction with no payroll taxes in a sole prop or parent-owned LLC. Estimated savings: ${fmt(v)}/year.`,
  'mega-backdoor-roth':(v) => `If your employer plan allows after-tax contributions, you can contribute an additional ~$43k/year to a Roth via in-plan conversion. Confirm your plan documents allow this. Estimated savings: ${fmt(v)}/year.`,
  'reps':              (v) => `Real Estate Professional status lets your rental losses offset all income without limit. Requires 750+ hours/year and more time in RE than any other profession. Document every hour. Estimated savings: ${fmt(v)}/year.`,
};

// ─── Core generator ───────────────────────────────────────────────────────────

export function generateActions(
  plan: GeneratedPlan,
  snapshot: FinancialSnapshot,
  repsHoursThisYear = 0,
  bonusPlan: BonusPlan | null = null,
  financialPhase?: FinancialPhase | null,
): ExecutionAction[] {
  const now   = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const cap   = plan.deployableCapitalPerYear;
  const spend = snapshot.monthlySpend || 1;

  // Computed early (rather than alongside hasDigital/hasIndex further below) because
  // the REPS-hours-behind this-week action needs it as a gate. Deliberately narrower
  // than "REPS relevant" (roadmap-based only, no currentlyOwnsRental) — this is the
  // same variable "Research your target rental market" and "Buy your first rental"
  // use further down, where an existing owner shouldn't see shopping actions.
  const hasRental = plan.assetRoadmap.some(r => r.assetType === 'long_term_rental' || r.assetType === 'short_term_rental');
  // REPS relevance is broader: also true for someone who already owns a rental, even
  // if (for whatever reason) their roadmap has no rental-type row.
  const repsRelevant = snapshot.currentlyOwnsRental || hasRental;

  const thisWeek: ExecutionAction[]    = [];
  const thisQuarter: ExecutionAction[] = [];
  const thisYear: ExecutionAction[]    = [];

  // ── THIS WEEK ───────────────────────────────────────────────────────────────

  // Emergency fund — phase-aware when financialPhase is available (same rule as
  // planGenerator.ts's Stabilize phase): funding_mini_ef targets the $5k mini-EF as an
  // active this-week action; paying_debt defers the full EF goal — not shown as an
  // urgent this-week action, surfaced instead as a this-year note since debt payoff is
  // the priority; building_full_ef shows the monthlySpend×6 target as active;
  // assets_unlocked needs no EF action at all. Falls back to the previous flat
  // "< 3mo spend" rule when financialPhase isn't provided, matching prior behavior for
  // callers that don't pass it.
  let efGoalActive = false;
  let efDeferred   = false;
  let efTarget     = spend * 6;
  if (financialPhase != null) {
    if (financialPhase === 'funding_mini_ef') {
      efGoalActive = true;
      efTarget = MINI_EMERGENCY_FUND_TARGET;
    } else if (financialPhase === 'building_full_ef') {
      efGoalActive = true;
    } else if (financialPhase === 'paying_debt') {
      efDeferred = true;
    }
    // assets_unlocked: efGoalActive and efDeferred both stay false — no EF action.
  } else {
    efGoalActive = snapshot.emergencyFund < spend * 3;
  }

  if (efGoalActive) {
    const target       = efTarget;
    const monthlyAdd   = Math.ceil((target - snapshot.emergencyFund) / 6);
    const sixMonthDate = new Date(now);
    sixMonthDate.setMonth(sixMonthDate.getMonth() + 6);
    const shortDate    = sixMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    thisWeek.push({
      title: 'Set up automatic transfer to emergency fund',
      description: `Set up a recurring transfer of ${fmt(monthlyAdd)}/month to reach your ${fmt(target)} target by ${shortDate}. Use a high-yield savings account (4%+ APY). Currently: ${fmt(snapshot.emergencyFund)} (${(snapshot.emergencyFund / spend).toFixed(1)} months covered).`,
      category: 'this_week', phase: 1, strategy_id: null,
      estimated_annual_value: 0, estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: addDays(now, 7), sort_order: thisWeek.length,
    });
  }

  // Augusta Rule active → document a meeting
  const augustaActive = plan.taxStrategyStack.strategies.find(
    s => s.id === 'augusta-rule' && s.state === 'ACTIVE',
  );
  if (augustaActive) {
    thisWeek.push({
      title: 'Document your Augusta Rule meeting',
      description: 'Hold and document a business meeting at your home this month. Required: written agenda, attendees, business purpose, date. Keep in your business records. You may hold up to 14 days/year tax-free.',
      category: 'this_week', phase: 2, strategy_id: 'augusta-rule',
      estimated_annual_value: augustaActive.estimatedAnnualValue,
      estimated_months_saved: monthsSaved(augustaActive.estimatedAnnualValue, cap),
      completed: false, completed_at: null, due_date: addDays(now, 7), sort_order: thisWeek.length,
    });
  }

  // REPS hours behind — second half of year. Gated on repsRelevant: without a rental
  // (owned or in the roadmap), REPS status isn't relevant regardless of hours logged.
  if (repsRelevant && repsHoursThisYear < 375 && month > 6) {
    const remaining  = 750 - repsHoursThisYear;
    const weeksLeft  = Math.max(1, Math.ceil((new Date(endOfYear(now)).getTime() - now.getTime()) / (7 * 86_400_000)));
    const perWeek    = Math.ceil(remaining / weeksLeft);
    thisWeek.push({
      title: "Log this week's real estate hours",
      description: `You need ${remaining} more hours by December 31 (${perWeek}/week pace). Log property research, manager calls, acquisition activities, and due diligence. Every documented hour counts.`,
      category: 'this_week', phase: 3, strategy_id: 'reps',
      estimated_annual_value: 0, estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: addDays(now, 7), sort_order: thisWeek.length,
    });
  }

  // CPA review — before mid-October
  if (month <= 10) {
    thisWeek.push({
      title: 'Schedule your CPA review',
      description: "Book a meeting with your CPA before October 15 to implement tax strategies for the current tax year. Come with your MoneyXprt strategy list. Waiting until January is too late to capture this year's savings.",
      category: 'this_week', phase: 2, strategy_id: null,
      estimated_annual_value: 0, estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: addDays(now, 7), sort_order: thisWeek.length,
    });
  }

  // ── THIS QUARTER ────────────────────────────────────────────────────────────

  // plan.taxStrategyStack is a stored snapshot from whenever the plan was last
  // generated/saved, and can go stale relative to the user's current data (e.g.
  // 1099 income present at plan-generation time but gone since). Re-evaluate every
  // strategy against the live snapshot — the same evaluateAll() the Audit page
  // uses — so a strategy that's since become LOCKED never gets an action.
  const currentEligibility = new Map(evaluateAll(snapshot).map(r => [r.id, r.state]));

  // One action per ACTIVE strategy worth > $500/yr
  const activeStrategies = plan.taxStrategyStack.strategies
    .filter(s => s.state === 'ACTIVE' && s.estimatedAnnualValue > 500 && currentEligibility.get(s.id) === 'ACTIVE')
    .sort((a, b) => b.estimatedAnnualValue - a.estimatedAnnualValue);

  for (const s of activeStrategies) {
    const descFn = STRATEGY_DESCRIPTIONS[s.id];
    thisQuarter.push({
      title: `Implement ${s.name}`,
      description: descFn ? descFn(s.estimatedAnnualValue) : `${s.reason} Estimated savings: ${fmt(s.estimatedAnnualValue)}/year.`,
      category: 'this_quarter', phase: 2, strategy_id: s.id,
      estimated_annual_value: s.estimatedAnnualValue,
      estimated_months_saved: monthsSaved(s.estimatedAnnualValue, cap),
      completed: false, completed_at: null, due_date: endOfQuarter(now), sort_order: 100 + thisQuarter.length,
    });
  }

  // Asset-preference actions (hasRental computed earlier, near the top of the function)
  const hasDigital = plan.assetRoadmap.some(r => r.assetType === 'digital_products');
  const hasIndex   = plan.assetRoadmap.some(r => r.assetType === 'index_investing');

  if (hasRental) {
    const firstRentalRow = plan.assetRoadmap.find(r => r.assetType === 'long_term_rental' || r.assetType === 'short_term_rental');
    thisQuarter.push({
      title: 'Research your target rental market',
      description: `Identify 3 target neighborhoods. Run numbers on 3 properties using the 1% rule as a quick filter. Connect with a local property manager. Your plan targets your first rental in ${firstRentalRow?.calendarYear ?? 'year 1–2'}.`,
      category: 'this_quarter', phase: 3, strategy_id: null,
      estimated_annual_value: firstRentalRow ? firstRentalRow.estimatedMonthlyIncomeAdded * 12 : 0,
      estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: endOfQuarter(now), sort_order: 100 + thisQuarter.length,
    });
  }

  if (hasDigital) {
    thisQuarter.push({
      title: 'Launch your first digital product',
      description: 'Publish your first paid piece of content — course, guide, template, or newsletter. Your knowledge is the product. Target: $500/month by end of quarter. The MoneyXprt methodology itself is a high-value starting point.',
      category: 'this_quarter', phase: 3, strategy_id: null,
      estimated_annual_value: 6_000,
      estimated_months_saved: monthsSaved(6_000, cap),
      completed: false, completed_at: null, due_date: endOfQuarter(now), sort_order: 100 + thisQuarter.length,
    });
  }

  if (hasIndex) {
    thisQuarter.push({
      title: 'Set up automatic index fund investing',
      description: `Automate your monthly investment on the 1st of each month using low-cost total market funds (VTSAX or equivalent). Your deployable capital target: ${fmt(cap / 12)}/month.`,
      category: 'this_quarter', phase: 3, strategy_id: null,
      estimated_annual_value: Math.round(cap * 0.07),
      estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: endOfQuarter(now), sort_order: 100 + thisQuarter.length,
    });
  }

  // ── THIS YEAR ───────────────────────────────────────────────────────────────

  // First rental/syndication acquisition
  const firstRentalRow = plan.assetRoadmap.find(
    r => r.assetType === 'long_term_rental' || r.assetType === 'short_term_rental' || r.assetType === 'syndication',
  );
  if (firstRentalRow) {
    thisYear.push({
      title: 'Buy your first rental property',
      description: `Target acquisition: ${firstRentalRow.calendarYear}. Adds ${fmt(firstRentalRow.estimatedMonthlyIncomeAdded)}/month in passive income. Start building your deal pipeline now — research, pre-approval, and property manager relationships take time to build.`,
      category: 'this_year', phase: 3, strategy_id: null,
      estimated_annual_value: firstRentalRow.estimatedMonthlyIncomeAdded * 12,
      estimated_months_saved: monthsSaved(firstRentalRow.estimatedMonthlyIncomeAdded * 12, cap),
      completed: false, completed_at: null, due_date: `${firstRentalRow.calendarYear}-12-31`, sort_order: 200 + thisYear.length,
    });
  }

  // Activate all tax strategies
  // Recomputed from activeStrategies (already re-gated against currentEligibility above)
  // rather than plan.taxStrategyStack.addedToDeployableCapital, which is a stale total from
  // whenever the plan was generated and can still include value from a strategy that has
  // since become LOCKED. Only cash strategies count toward deployable capital — projected
  // strategies (e.g. backdoor Roth) represent long-term value, not capital available this year.
  const totalSavings = activeStrategies
    .filter(s => s.valueType === 'cash')
    .reduce((sum, s) => sum + s.estimatedAnnualValue, 0);
  if (totalSavings > 0 && activeStrategies.length > 0) {
    thisYear.push({
      title: 'Activate all tax strategies',
      description: `Implement all ${activeStrategies.length} identified tax strateg${activeStrategies.length === 1 ? 'y' : 'ies'} to unlock ${fmt(totalSavings)}/year in additional deployable capital. Each strategy compounds — the savings go straight back into your investment engine.`,
      category: 'this_year', phase: 2, strategy_id: null,
      estimated_annual_value: totalSavings,
      estimated_months_saved: monthsSaved(totalSavings, cap),
      completed: false, completed_at: null, due_date: endOfYear(now), sort_order: 200 + thisYear.length,
    });
  }

  // First passive income milestone
  const firstIncomeRow = plan.assetRoadmap.find(r => r.cumulativeMonthlyIncome > 0);
  if (firstIncomeRow) {
    const target = Math.ceil(firstIncomeRow.cumulativeMonthlyIncome / 500) * 500;
    thisYear.push({
      title: `Hit ${fmt(target)}/month in passive income`,
      description: `Your first passive income milestone. This is proof-of-concept — your money is working for you. Reach ${fmt(target)}/month from rentals, dividends, and other income streams.`,
      category: 'this_year', phase: 3, strategy_id: null,
      estimated_annual_value: target * 12,
      estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: `${firstIncomeRow.calendarYear}-12-31`, sort_order: 200 + thisYear.length,
    });
  }

  // REPS hour requirement — repsRelevant (not just hasRental) so an existing rental
  // owner still sees this even if their roadmap happens to lack a rental-type row.
  if (repsRelevant) {
    thisYear.push({
      title: 'Complete 750 REPS hour requirement',
      description: 'Material participation in real estate requires 750+ hours/year and more time in RE than any other profession. Log and document every hour by December 31 to qualify for the powerful tax benefits of REPS status.',
      category: 'this_year', phase: 3, strategy_id: 'reps',
      estimated_annual_value: 0, estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: endOfYear(now), sort_order: 200 + thisYear.length,
    });
  }

  // Deferred full emergency fund — paying_debt phase only (see efDeferred above).
  // Not urgent (debt payoff is the priority), so this lands in this_year rather than
  // this_week — the least-urgent bucket this file has, since ExecutionAction has no
  // separate "pending"/deferred category to mirror planGenerator's phase-status field.
  if (efDeferred) {
    thisYear.push({
      title: 'Build full emergency fund once debt is cleared',
      description: `Once your debt is paid off, build your full emergency fund to ${fmt(efTarget)} (6 months of expenses). Deferred for now — paying down debt is the priority.`,
      category: 'this_year', phase: 1, strategy_id: null,
      estimated_annual_value: 0, estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: endOfYear(now), sort_order: 200 + thisYear.length,
    });
  }

  // Log this year's bonus payment — only relevant for quarterly/annual plans with a
  // payment month set. Monthly-frequency bonuses never check bonus_payments_actual at
  // all (see deployableCapital.ts), so there's nothing to log against for them.
  if (bonusPlan && bonusPlan.frequency !== 'monthly' && bonusPlan.paymentMonth != null) {
    thisYear.push({
      title: "Log this year's bonus payment",
      description: 'Once your bonus is actually paid, log the amount (and net, if you know it) in Actuals. Your deployable capital currently uses a withholding estimate until you do — real numbers replace the estimate automatically.',
      category: 'this_year', phase: 2, strategy_id: null,
      estimated_annual_value: 0, estimated_months_saved: 0,
      completed: false, completed_at: null, due_date: endOfYear(now), sort_order: 200 + thisYear.length,
    });
  }

  // Cap to spec limits, combine, and deduplicate by title + strategy_id
  const addedTitles      = new Set<string>();
  const addedStrategyIds = new Set<string>();

  const combined: ExecutionAction[] = [];
  for (const action of [
    ...thisWeek.slice(0, 3),
    ...thisQuarter.slice(0, 7),
    ...thisYear.slice(0, 5),
  ]) {
    if (addedTitles.has(action.title)) continue;
    if (action.strategy_id && addedStrategyIds.has(action.strategy_id)) continue;
    addedTitles.add(action.title);
    if (action.strategy_id) addedStrategyIds.add(action.strategy_id);
    combined.push(action);
  }
  return combined;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

// Module-level guard — prevents concurrent saves from racing each other
let _saveInProgress = false;

export async function saveActions(actions: ExecutionAction[], userId: string): Promise<void> {
  if (_saveInProgress) return;
  _saveInProgress = true;
  try {
    const { getBrowserSupabaseClient } = await import('@/app/utils/supabaseClient');
    const sb = getBrowserSupabaseClient();

    // 1. Fetch titles of already-completed actions so we can preserve them exactly as-is.
    //    We skip regenerating any action whose title matches a completed one — the user's
    //    completion state must not be overwritten by a fresh plan generation.
    const { data: completedRows, error: fetchError } = await sb
      .from('execution_actions')
      .select('title')
      .eq('user_id', userId)
      .eq('completed', true);

    if (fetchError) {
      console.error('saveActions: failed to fetch completed titles:', fetchError.message);
      return;
    }

    const completedTitles = new Set((completedRows ?? []).map(r => r.title as string));

    // 2. Exclude any generated action whose title is already marked completed.
    //    Those rows stay untouched in the database.
    const actionsToUpsert = actions.filter(a => !completedTitles.has(a.title));

    // 3. Delete all incomplete actions — safe because completed ones are preserved
    //    (the DELETE filter is .eq('completed', false)) and we just fetched/excluded
    //    anything that would conflict with the upsert below.
    const { error: deleteError } = await sb
      .from('execution_actions')
      .delete()
      .eq('user_id', userId)
      .eq('completed', false);

    if (deleteError) {
      console.error('saveActions: delete failed, aborting upsert:', deleteError.message);
      return;
    }

    if (actionsToUpsert.length === 0) return;

    // 4. Upsert — onConflict matches the execution_actions_user_title_unique constraint.
    //    ignoreDuplicates: false means existing rows (e.g. any race-condition survivors)
    //    get updated rather than silently skipped.
    const rows = actionsToUpsert.map(({ id: _id, user_id: _uid, created_at: _ca, ...rest }) => ({
      ...rest,
      user_id: userId,
    }));

    const { error: upsertError } = await sb
      .from('execution_actions')
      .upsert(rows, { onConflict: 'user_id,title', ignoreDuplicates: false });

    if (upsertError) throw new Error(`saveActions upsert failed: ${upsertError.message}`);
  } finally {
    _saveInProgress = false;
  }
}

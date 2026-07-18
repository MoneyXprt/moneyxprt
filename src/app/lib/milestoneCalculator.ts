import type { GeneratedPlan } from './planGenerator';
import type { FinancialSnapshot } from './strategies/types';
import type { FinancialPhase } from './financialPhase';

export interface Milestone {
  id:        string;
  label:     string;
  sublabel:  string;
  icon:      string;
  year:      number;
  month:     number;
  color:     string;
  completed: boolean;
  category:  'stability' | 'strategy' | 'asset' | 'income' | 'freedom';
}

const ASSET_ICONS: Record<string, string> = {
  long_term_rental:  '🏠',
  digital_products:  '💻',
  index_investing:   '📈',
  short_term_rental: '🏖️',
  syndication:       '🏢',
};
const ASSET_COLORS: Record<string, string> = {
  long_term_rental:  'blue',
  digital_products:  'purple',
  index_investing:   'emerald',
  short_term_rental: 'blue',
  syndication:       'gray',
};

export function calculateMilestones(
  plan:                        GeneratedPlan,
  snapshot:                    FinancialSnapshot,
  capitalPerYear:              number,
  currentYear:                 number,
  targetFreeAge:               number,
  completedActionTitles:       string[],
  thisYearIncompleteActions:   Array<{ id: string; title: string; sort_order?: number; due_date?: string | null }>,
  financialPhase?:             FinancialPhase | null,
): Milestone[] {
  const milestones: Milestone[] = [];

  // ── Source 1 — Emergency fund ─────────────────────────────────────────────
  // Phase-aware when financialPhase is available: this milestone only ever appears
  // once financialPhase is 'building_full_ef' (or a snapshot with no active debt has
  // already reached that stage) — funding_mini_ef and paying_debt both omit it
  // entirely, matching how the rental-timing milestone (Source 2) now reflects real
  // debt-payoff sequencing instead of a computed date that ignores it. A near-term
  // "Emergency Fund Complete" projection during either of those earlier phases would
  // be based on capital that's actually being redirected to debt/mini-EF first, so the
  // date would be fiction. Falls back to the previous flat "target 6mo" rule when
  // financialPhase isn't provided, matching prior behavior for callers that don't pass it.
  let efGoalActive = false;
  const efTarget    = snapshot.monthlySpend * 6;
  if (financialPhase != null) {
    efGoalActive = financialPhase === 'building_full_ef';
    // funding_mini_ef / paying_debt / assets_unlocked: efGoalActive stays false — no milestone shown.
  } else {
    efGoalActive = snapshot.emergencyFund < efTarget;
  }

  if (efGoalActive && snapshot.emergencyFund < efTarget && efTarget > 0 && capitalPerYear > 0) {
    const deficit = efTarget - snapshot.emergencyFund;
    const monthsNeeded = deficit / (capitalPerYear / 12);
    milestones.push({
      id:        'emergency_fund',
      label:     'Emergency Fund Complete',
      sublabel:  `$${Math.round(efTarget).toLocaleString()} fully funded`,
      icon:      '🛡️',
      year:      currentYear + Math.ceil(monthsNeeded / 12),
      month:     6,
      color:     'amber',
      completed: snapshot.emergencyFund >= efTarget,
      category:  'stability',
    });
  }

  // ── Source 2 — Asset acquisition events from roadmap ─────────────────────
  let seenIndexInvesting = false;
  const roadmapAssetTypesCovered = new Set<string>();
  plan.assetRoadmap
    .filter(row => {
      if (row.capitalDeployed <= 0) return false;
      if (row.assetType === 'index_investing') {
        if (seenIndexInvesting) return false;
        seenIndexInvesting = true;
      }
      return true;
    })
    .forEach((row, index) => {
      roadmapAssetTypesCovered.add(row.assetType);
      milestones.push({
        id:       `asset_${index}_${row.assetType}`,
        label:    row.action,
        sublabel: `+$${Math.round(row.estimatedMonthlyIncomeAdded).toLocaleString()}/mo passive income`,
        icon:     ASSET_ICONS[row.assetType] ?? '💰',
        year:     row.calendarYear,
        month:    6,
        color:    ASSET_COLORS[row.assetType] ?? 'blue',
        completed: false,
        category: 'asset',
      });
    });

  // ── Source 3 — Income threshold crossings ────────────────────────────────
  const fn = plan.freedomGap.freedomNumberMonthly;
  for (const pct of [0.25, 0.5, 0.75]) {
    const target      = fn * pct;
    const crossingRow = plan.assetRoadmap.find(row => row.cumulativeMonthlyIncome >= target);
    if (crossingRow) {
      milestones.push({
        id:       `income_${pct}`,
        label:    `$${Math.round(target).toLocaleString()}/mo Passive Income`,
        sublabel: `${Math.round(pct * 100)}% of your freedom number`,
        icon:     '📊',
        year:     crossingRow.calendarYear,
        month:    3,
        color:    'emerald',
        completed: plan.freedomGap.currentPassiveMonthly >= target,
        category: 'income',
      });
    }
  }

  // ── Source 4 — Freedom milestones ─────────────────────────────────────────
  const freedomRow = plan.assetRoadmap.find(row => row.remainingGap === 0);
  const freedomYear = freedomRow?.calendarYear ?? plan.freedomGap.projectedFreedomYear;
  if (freedomYear > 0) {
    milestones.push({
      id:       'full_freedom',
      label:    'Full Freedom',
      sublabel: `Free at age ${targetFreeAge}`,
      icon:     '⭐',
      year:     freedomYear,
      month:    6,
      color:    'forest',
      completed: false,
      category: 'freedom',
    });
  }

  // ── Source 5 — This-year strategy milestones ──────────────────────────────
  // execution_actions can go stale relative to the live roadmap — e.g. "Buy your
  // first rental property" gets generated whenever a rental appears anywhere in the
  // roadmap, regardless of how far out. If that same asset type already has a correct,
  // roadmap-derived Source 2 entry (real year, not a placeholder), showing this one too
  // would just contradict it with a hardcoded "this year" that's frequently wrong.
  // Titles below are exactly the this-year action titles actionGenerator.ts generates
  // that correspond to a specific asset type — mapped to the same assetType values
  // Source 2 iterates over above.
  const ROADMAP_COVERED_TITLES: Record<string, string[]> = {
    'Buy your first rental property':        ['long_term_rental', 'short_term_rental', 'syndication'],
    'Launch your first digital product':     ['digital_products'],
    'Set up automatic index fund investing': ['index_investing'],
  };

  thisYearIncompleteActions
    .filter(action => {
      const coveredTypes = ROADMAP_COVERED_TITLES[action.title];
      if (!coveredTypes) return true; // date-agnostic action (e.g. "Activate all tax strategies") — no roadmap counterpart, always keep
      return !coveredTypes.some(t => roadmapAssetTypesCovered.has(t));
    })
    .slice(0, 2)
    .forEach((action, i) => {
      // Reflect the action's real due_date when it has one, instead of always
      // hardcoding the current year — a due_date in a past or future year means
      // "this year" was never accurate for it in the first place.
      const dueDate = action.due_date ? new Date(action.due_date) : null;
      milestones.push({
        id:       `strategy_${action.id}`,
        label:    action.title,
        sublabel: 'This year priority',
        icon:     '📋',
        year:     dueDate ? dueDate.getUTCFullYear() : currentYear,
        month:    dueDate ? dueDate.getUTCMonth() + 1 : ([3, 6][i] ?? 9),
        color:    'amber',
        completed: completedActionTitles.includes(action.title),
        category: 'strategy',
      });
    });

  // Sort and deduplicate
  const seen = new Set<string>();
  return milestones
    .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

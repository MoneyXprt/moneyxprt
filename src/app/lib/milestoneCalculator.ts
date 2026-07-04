import type { GeneratedPlan } from './planGenerator';
import type { FinancialSnapshot } from './strategies/types';

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
  thisYearIncompleteActions:   Array<{ id: string; title: string; sort_order?: number }>,
): Milestone[] {
  const milestones: Milestone[] = [];

  // ── Source 1 — Emergency fund ─────────────────────────────────────────────
  const emergencyTarget = snapshot.monthlySpend * 6;
  if (snapshot.emergencyFund < emergencyTarget && emergencyTarget > 0 && capitalPerYear > 0) {
    const deficit = emergencyTarget - snapshot.emergencyFund;
    const monthsNeeded = deficit / (capitalPerYear / 12);
    milestones.push({
      id:        'emergency_fund',
      label:     'Emergency Fund Complete',
      sublabel:  `$${Math.round(emergencyTarget).toLocaleString()} fully funded`,
      icon:      '🛡️',
      year:      currentYear + Math.ceil(monthsNeeded / 12),
      month:     6,
      color:     'amber',
      completed: snapshot.emergencyFund >= emergencyTarget,
      category:  'stability',
    });
  }

  // ── Source 2 — Asset acquisition events from roadmap ─────────────────────
  let seenIndexInvesting = false;
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
  thisYearIncompleteActions.slice(0, 2).forEach((action, i) => {
    milestones.push({
      id:       `strategy_${action.id}`,
      label:    action.title,
      sublabel: 'This year priority',
      icon:     '📋',
      year:     currentYear,
      month:    [3, 6][i] ?? 9,
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

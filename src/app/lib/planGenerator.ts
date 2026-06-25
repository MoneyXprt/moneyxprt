/**
 * planGenerator.ts
 *
 * Pure TypeScript plan generation engine — no network calls, no side effects.
 * Import generatePlan for the pure computation.
 * Import savePlan for the Supabase persistence layer (separate concern).
 */

import { evaluateAll } from '@/app/lib/strategies';
import type { FinancialSnapshot, StrategyResult } from '@/app/lib/strategies/types';

// ─── Input / output types ─────────────────────────────────────────────────────

export interface PlanInputs {
  freedomProfile: {
    visionText: string | null;
    targetFreeAge: number;
    freedomType: 'never_work' | 'work_optional' | 'lower_stress';
  };
  freedomNumber: {
    monthlyTarget: number;
    portfolioTarget: number;
    breakdown: Record<string, number>;
  };
  snapshot: FinancialSnapshot;
  assetPreferences: string[];   // array of asset_type keys
  constraints: {
    capitalPerYear: number;
    hoursPerWeek: number;
    riskTolerance: string;
    hardConstraints: string[];  // array of constraint keys
  };
}

export type PhaseStatus = 'active' | 'pending';

export interface PlanAction {
  text: string;
  priority: 'high' | 'medium' | 'low';
  annualValue?: number;
}

export interface Phase {
  number: number;
  title: string;
  status: PhaseStatus;
  reason: string;
  actions: PlanAction[];
}

export interface AssetRoadmapRow {
  year: number;
  calendarYear: number;
  action: string;
  assetType: string;
  capitalDeployed: number;
  estimatedMonthlyIncomeAdded: number;
  cumulativeMonthlyIncome: number;
  remainingGap: number;
}

export interface GeneratedPlan {
  freedomGap: {
    freedomNumberMonthly: number;
    currentPassiveMonthly: number;
    gapMonthly: number;
    projectedFreedomYear: number;
    yearsToFreedom: number;
  };
  phases: Phase[];
  taxStrategyStack: {
    annualValue: number;
    strategies: StrategyResult[];
    addedToDeployableCapital: number;
  };
  assetRoadmap: AssetRoadmapRow[];
  deployableCapitalPerYear: number;
  aiNarrative: null;
}

// ─── Asset configuration ──────────────────────────────────────────────────────

interface AssetConfig {
  id: string;
  title: string;
  downPayment: number;
  baseMonthlyIncome: number;     // 0 for index_investing (dynamic)
  dynamicIncome: boolean;        // true = income = capitalDeployed * 0.07 / 12
  minHours: number;
  requiresActiveManagement: boolean;
  requiresAccredited: boolean;
}

const ASSET_CONFIGS: AssetConfig[] = [
  {
    id: 'long_term_rental',
    title: 'Long Term Rental',
    downPayment: 80_000,
    baseMonthlyIncome: 1_000,
    dynamicIncome: false,
    minHours: 0,
    requiresActiveManagement: false,
    requiresAccredited: false,
  },
  {
    id: 'short_term_rental',
    title: 'Short Term Rental',
    downPayment: 100_000,
    baseMonthlyIncome: 2_000,
    dynamicIncome: false,
    minHours: 3,
    requiresActiveManagement: true,
    requiresAccredited: false,
  },
  {
    id: 'syndication',
    title: 'Real Estate Syndication',
    downPayment: 75_000,
    baseMonthlyIncome: 800,
    dynamicIncome: false,
    minHours: 0,
    requiresActiveManagement: false,
    requiresAccredited: true,
  },
  {
    id: 'index_investing',
    title: 'Index Fund Portfolio',
    downPayment: 10_000,
    baseMonthlyIncome: 0,
    dynamicIncome: true,   // income = downPayment * 0.07 / 12
    minHours: 0,
    requiresActiveManagement: false,
    requiresAccredited: false,
  },
  {
    id: 'digital_products',
    title: 'Digital Products / Content',
    downPayment: 0,
    baseMonthlyIncome: 2_000,
    dynamicIncome: false,
    minHours: 5,
    requiresActiveManagement: false,
    requiresAccredited: false,
  },
  {
    id: 'private_lending',
    title: 'Private Lending',
    downPayment: 50_000,
    baseMonthlyIncome: 400,
    dynamicIncome: false,
    minHours: 0,
    requiresActiveManagement: false,
    requiresAccredited: false,
  },
];

function getMonthlyIncome(cfg: AssetConfig, capitalDeployed: number): number {
  return cfg.dynamicIncome ? capitalDeployed * 0.07 / 12 : cfg.baseMonthlyIncome;
}

function actionPriority(value: number): 'high' | 'medium' | 'low' {
  if (value > 2_000) return 'high';
  if (value > 500)   return 'medium';
  return 'low';
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// ─── Core generator ───────────────────────────────────────────────────────────

export function generatePlan(inputs: PlanInputs): GeneratedPlan {
  const { freedomNumber, snapshot, assetPreferences, constraints } = inputs;
  const { hardConstraints } = constraints;
  const currentYear = new Date().getFullYear();

  // ── Step 1: Freedom gap ───────────────────────────────────────────────────
  const currentPassiveMonthly = snapshot.monthlyRentalIncome + snapshot.monthlyDividendIncome;
  const gapMonthly = Math.max(0, freedomNumber.monthlyTarget - currentPassiveMonthly);

  // ── Step 2: Deployable capital ────────────────────────────────────────────
  const strategyResults = evaluateAll(snapshot);
  const taxSavingsActive = strategyResults
    .filter(r => r.state === 'ACTIVE')
    .reduce((s, r) => s + r.estimatedAnnualValue, 0);
  const taxSavingsVerify = strategyResults
    .filter(r => r.state === 'VERIFY')
    .reduce((s, r) => s + r.estimatedAnnualValue * 0.5, 0);
  const addedToDeployableCapital = taxSavingsActive + taxSavingsVerify;
  const deployableCapitalPerYear = constraints.capitalPerYear + addedToDeployableCapital;

  // ── Step 3: Phases ────────────────────────────────────────────────────────
  const phases: Phase[] = [];
  let phaseNum = 0;

  // Phase 1 — Stabilize (conditional)
  const lowEmergencyFund = snapshot.emergencyFund < snapshot.monthlySpend * 3;
  const hasDebt = hardConstraints.includes('significant_debt');
  if (lowEmergencyFund || hasDebt) {
    phaseNum++;
    const p1Actions: PlanAction[] = [];
    if (lowEmergencyFund) {
      const target = snapshot.monthlySpend * 6;
      p1Actions.push({
        text: `Build emergency fund to ${fmt(target)} — currently ${fmt(snapshot.emergencyFund)} (${(snapshot.emergencyFund / Math.max(1, snapshot.monthlySpend)).toFixed(1)} months of expenses). Target: 6 months.`,
        priority: 'high',
      });
    }
    if (hasDebt) {
      p1Actions.push({
        text: 'Develop debt paydown strategy — eliminate high-interest debt before deploying capital to assets. High-rate debt is a guaranteed negative return.',
        priority: 'high',
      });
    }
    phases.push({
      number: phaseNum,
      title: 'Stabilize',
      status: 'active',
      reason: [
        lowEmergencyFund && 'Emergency fund is below 3 months of expenses.',
        hasDebt && 'Significant debt was flagged as a priority constraint.',
      ].filter(Boolean).join(' '),
      actions: p1Actions,
    });
  }

  // Phase 2 — Reduce the Drag (always)
  phaseNum++;
  const activeStrategies = strategyResults.filter(r => r.state === 'ACTIVE');
  const p2Actions: PlanAction[] = activeStrategies
    .sort((a, b) => b.estimatedAnnualValue - a.estimatedAnnualValue)
    .map(r => ({
      text: `${r.name} — ${fmt(r.estimatedAnnualValue)}/yr tax savings`,
      priority: actionPriority(r.estimatedAnnualValue),
      annualValue: r.estimatedAnnualValue,
    }));
  phases.push({
    number: phaseNum,
    title: 'Reduce the Drag',
    status: 'active',
    reason: `${activeStrategies.length} tax strategies identified. Implementing them adds ${fmt(addedToDeployableCapital)}/year to your deployable capital.`,
    actions: p2Actions.length > 0 ? p2Actions : [{
      text: 'Complete your financial snapshot to unlock personalised tax strategy recommendations.',
      priority: 'medium',
    }],
  });

  // Phase 3 — Build the Engines (always)
  phaseNum++;
  const eligibleConfigs = ASSET_CONFIGS.filter(cfg => {
    if (!assetPreferences.includes(cfg.id)) return false;
    if (cfg.requiresActiveManagement && hardConstraints.includes('cannot_manage_property')) return false;
    if (cfg.requiresAccredited && hardConstraints.includes('not_accredited')) return false;
    if (cfg.minHours > constraints.hoursPerWeek) return false;
    return true;
  });
  const p3Actions: PlanAction[] = eligibleConfigs.map(cfg => {
    const income = cfg.dynamicIncome ? cfg.downPayment * 0.07 / 12 : cfg.baseMonthlyIncome;
    const priority = income > 1_500 ? 'high' : income > 700 ? 'medium' : 'low';
    const capitalNote = cfg.downPayment > 0 ? ` Requires ${fmt(cfg.downPayment)} down.` : ' Low startup capital.';
    return {
      text: `${cfg.title} — adds ~${fmt(income)}/mo in passive income.${capitalNote}`,
      priority,
    };
  });
  if (p3Actions.length === 0) {
    p3Actions.push({
      text: 'No assets match your current constraints and preferences. Review your asset preferences or constraints to expand options.',
      priority: 'medium',
    });
  }
  phases.push({
    number: phaseNum,
    title: 'Build the Engines',
    status: phaseNum > 2 ? 'pending' : 'active',
    reason: `${eligibleConfigs.length} asset type${eligibleConfigs.length !== 1 ? 's' : ''} eligible based on your preferences and constraints.`,
    actions: p3Actions,
  });

  // Phase 4 — Execute and Track (always)
  phaseNum++;
  phases.push({
    number: phaseNum,
    title: 'Execute and Track',
    status: 'pending',
    reason: 'Ongoing execution discipline determines outcomes. These actions protect your plan.',
    actions: [
      {
        text: 'Maintain contemporaneous REPS time logs — required for audit defense (IRC §469(c)(7)). Reconstruct records are routinely rejected.',
        priority: 'high',
      },
      {
        text: 'Schedule a CPA review before year-end to implement top tax strategies and capture current-year savings.',
        priority: 'high',
      },
      {
        text: 'Update your financial snapshot quarterly — keeps plan recommendations current as your numbers change.',
        priority: 'medium',
      },
      {
        text: 'Review asset roadmap annually — rebalance capital deployment as markets, interest rates, and opportunities shift.',
        priority: 'low',
      },
    ],
  });

  // ── Step 6: Asset roadmap ─────────────────────────────────────────────────
  const roadmap: AssetRoadmapRow[] = [];
  let capitalAccumulated = 0;
  let cumulativeMonthlyIncome = currentPassiveMonthly;
  let capitalCycleIndex = 0;
  let projectedFreedomYear = currentYear + 20;
  let yearsToFreedom = 20;
  const freedomTarget = freedomNumber.monthlyTarget;

  /** Monthly income growth cap and step for zero-cost content businesses. */
  const ZERO_COST_GROWTH_STEP = 500;
  const ZERO_COST_INCOME_CAP  = 5_000;
  const ZERO_COST_GROWTH_INTERVAL = 2; // years between growth events

  // Separate zero-cost assets (digital_products) from capital-required assets.
  // This eliminates the infinite-loop bug caused by cycling back to a
  // already-acquired zero-cost asset while inside the while loop.
  const zeroCostEligible   = eligibleConfigs.filter(c => c.downPayment === 0);
  const capitalEligible    = eligibleConfigs.filter(c => c.downPayment > 0);
  const fallbackCapital    = [ASSET_CONFIGS.find(c => c.id === 'index_investing')!];
  const capitalAssets      = capitalEligible.length > 0 ? capitalEligible : fallbackCapital;

  // Track launched zero-cost assets: id → { launchYear, currentMonthlyIncome }
  const launchedZeroCost = new Map<string, { launchYear: number; currentIncome: number; cfg: AssetConfig }>();

  // If already free
  if (gapMonthly <= 0) {
    projectedFreedomYear = currentYear;
    yearsToFreedom = 0;
  } else {
    for (let year = 1; year <= 20; year++) {
      capitalAccumulated += deployableCapitalPerYear;
      let yearAcquired = false;

      // ── 1. Launch zero-cost assets (each only once, in year 1 of the plan) ──
      for (const cfg of zeroCostEligible) {
        if (!launchedZeroCost.has(cfg.id)) {
          const income = cfg.baseMonthlyIncome;
          cumulativeMonthlyIncome += income;
          launchedZeroCost.set(cfg.id, { launchYear: year, currentIncome: income, cfg });
          roadmap.push({
            year,
            calendarYear: currentYear + year,
            action: `Launch ${cfg.title}`,
            assetType: cfg.id,
            capitalDeployed: 0,
            estimatedMonthlyIncomeAdded: income,
            cumulativeMonthlyIncome,
            remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
          });
          yearAcquired = true;
          if (cumulativeMonthlyIncome >= freedomTarget) break;
        }
      }
      if (cumulativeMonthlyIncome >= freedomTarget) {
        projectedFreedomYear = currentYear + year;
        yearsToFreedom = year;
        break;
      }

      // ── 2. Growth events for launched zero-cost assets ────────────────────
      // Every ZERO_COST_GROWTH_INTERVAL years after launch, income grows by
      // ZERO_COST_GROWTH_STEP up to ZERO_COST_INCOME_CAP.
      for (const [id, state] of launchedZeroCost) {
        const yearsSinceLaunch = year - state.launchYear;
        const isDueForGrowth   = yearsSinceLaunch > 0 && yearsSinceLaunch % ZERO_COST_GROWTH_INTERVAL === 0;
        if (isDueForGrowth && state.currentIncome < ZERO_COST_INCOME_CAP) {
          const growth = Math.min(ZERO_COST_GROWTH_STEP, ZERO_COST_INCOME_CAP - state.currentIncome);
          cumulativeMonthlyIncome += growth;
          state.currentIncome     += growth;
          launchedZeroCost.set(id, state);
          roadmap.push({
            year,
            calendarYear: currentYear + year,
            action: `${state.cfg.title} revenue grows to ${fmt(state.currentIncome)}/mo`,
            assetType: id,
            capitalDeployed: 0,
            estimatedMonthlyIncomeAdded: growth,
            cumulativeMonthlyIncome,
            remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
          });
          yearAcquired = true;
          if (cumulativeMonthlyIncome >= freedomTarget) break;
        }
      }
      if (cumulativeMonthlyIncome >= freedomTarget) {
        projectedFreedomYear = currentYear + year;
        yearsToFreedom = year;
        break;
      }

      // ── 3. Acquire capital assets while funds allow ───────────────────────
      let acquired = true;
      while (acquired && capitalAssets.length > 0) {
        acquired = false;
        const cfg = capitalAssets[capitalCycleIndex % capitalAssets.length];
        if (capitalAccumulated >= cfg.downPayment) {
          capitalAccumulated -= cfg.downPayment;
          const income = getMonthlyIncome(cfg, cfg.downPayment);
          cumulativeMonthlyIncome += income;
          roadmap.push({
            year,
            calendarYear: currentYear + year,
            action: `Acquire ${cfg.title}`,
            assetType: cfg.id,
            capitalDeployed: cfg.downPayment,
            estimatedMonthlyIncomeAdded: income,
            cumulativeMonthlyIncome,
            remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
          });
          capitalCycleIndex++;
          yearAcquired = true;
          acquired = true;
          if (cumulativeMonthlyIncome >= freedomTarget) break;
        }
      }
      if (cumulativeMonthlyIncome >= freedomTarget) {
        projectedFreedomYear = currentYear + year;
        yearsToFreedom = year;
        break;
      }

      // ── 4. Nothing acquired — show capital-building progress ─────────────
      if (!yearAcquired) {
        const nextCfg = capitalAssets[capitalCycleIndex % capitalAssets.length];
        roadmap.push({
          year,
          calendarYear: currentYear + year,
          action: `Building toward ${nextCfg.title} (${fmt(capitalAccumulated)} of ${fmt(nextCfg.downPayment)} saved)`,
          assetType: nextCfg.id,
          capitalDeployed: 0,
          estimatedMonthlyIncomeAdded: 0,
          cumulativeMonthlyIncome,
          remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
        });
      }
    }
  }

  return {
    freedomGap: {
      freedomNumberMonthly: freedomNumber.monthlyTarget,
      currentPassiveMonthly,
      gapMonthly,
      projectedFreedomYear,
      yearsToFreedom,
    },
    phases,
    taxStrategyStack: {
      annualValue: taxSavingsActive,
      strategies: strategyResults.filter(r => r.state === 'ACTIVE'),
      addedToDeployableCapital,
    },
    assetRoadmap: roadmap,
    deployableCapitalPerYear,
    aiNarrative: null,
  };
}

// ─── Persistence layer ────────────────────────────────────────────────────────

export async function savePlan(plan: GeneratedPlan, userId: string): Promise<void> {
  const { getBrowserSupabaseClient } = await import('@/app/utils/supabaseClient');
  const sb = getBrowserSupabaseClient();

  const projectedFreedomDate =
    plan.freedomGap.projectedFreedomYear > 0
      ? `${plan.freedomGap.projectedFreedomYear}-01-01`
      : null;

  const { error } = await sb.from('generated_plans').upsert(
    {
      user_id:                     userId,
      freedom_gap:                 plan.freedomGap,
      phases:                      plan.phases,
      tax_strategy_stack:          plan.taxStrategyStack,
      asset_roadmap:               plan.assetRoadmap,
      deployable_capital_per_year: plan.deployableCapitalPerYear,
      ai_narrative:                null,
      projected_freedom_date:      projectedFreedomDate,
    },
    { onConflict: 'user_id' },
  );

  if (error) throw new Error(`savePlan failed: ${error.message}`);
}

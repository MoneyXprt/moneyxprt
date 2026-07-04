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
    rentalTaxUnlockAnnualValue?: number;  // extra annual value unlocked when first rental is acquired
  };
  assetRoadmap: AssetRoadmapRow[];
  deployableCapitalPerYear: number;
  aiNarrative: null;
}

// ─── Income assumptions (optional overrides) ─────────────────────────────────

export interface IncomeAssumptions {
  businessMonthly12: number;
  businessMonthly36: number;
  spouseBusinessMonthly12: number;
  spouseBusinessMonthly36: number;
  digitalProductsMonthly12: number;
  digitalProductsMonthly36: number;
  digitalProductsPeak: number;
  firstRentalDelayYears?: number;
  bonusGrowthRate?: number;   // fractional, e.g. 0.05 = 5%
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

export function generatePlan(inputs: PlanInputs, incomeAssumptions?: IncomeAssumptions): GeneratedPlan {
  const { freedomNumber, snapshot, assetPreferences, constraints } = inputs;
  const { hardConstraints } = constraints;
  const currentYear = new Date().getFullYear();

  // ── Step 1: Freedom gap ───────────────────────────────────────────────────
  const currentPassiveMonthly = snapshot.monthlyRentalIncome + snapshot.monthlyDividendIncome;
  const gapMonthly = Math.max(0, freedomNumber.monthlyTarget - currentPassiveMonthly);

  // ── Step 2: Deployable capital ────────────────────────────────────────────
  const strategyResults = evaluateAll(snapshot);
  const excludedIds = snapshot.excludedStrategyIds ?? [];
  const taxSavingsActive = strategyResults
    .filter(r => r.state === 'ACTIVE' && r.valueType === 'cash' && !excludedIds.includes(r.id))
    .reduce((s, r) => s + r.estimatedAnnualValue, 0);
  const taxSavingsVerify = strategyResults
    .filter(r => r.state === 'VERIFY' && r.valueType === 'cash')
    .reduce((s, r) => s + r.estimatedAnnualValue * 0.5, 0);
  const addedToDeployableCapital = taxSavingsActive + taxSavingsVerify;
  const deployableCapitalPerYear = constraints.capitalPerYear + addedToDeployableCapital;

  // ── Step 2b: Post-rental tax unlock value ─────────────────────────────────
  // If the user doesn't currently own a rental but the roadmap will acquire one,
  // compute how much additional annual value depreciation/REPS would unlock.
  // This is used to boost deployableCapitalPerYear the year AFTER acquisition.
  let rentalTaxUnlockAnnualValue = 0;
  const wantsRental = assetPreferences.some(p => p === 'long_term_rental' || p === 'short_term_rental');
  const simulationWillRun = !snapshot.currentlyOwnsRental && wantsRental && snapshot.consideringRealEstate;
  console.log(
    '[planGenerator] rental tax-unlock simulation:',
    JSON.stringify({
      assetPreferences,
      consideringRealEstate: snapshot.consideringRealEstate,
      currentlyOwnsRental: snapshot.currentlyOwnsRental,
      wantsRental,
      simulationWillRun,
    }),
  );
  if (simulationWillRun) {
    const rentalPropertyValue = snapshot.plannedPropertyValue ?? 350_000;
    // REPS is viable when the non-working spouse can dedicate 750+ hours to RE activities.
    // If the spouse doesn't work, REPS is ACTIVE → simulate with repsQualified: true
    // so depreciation shows its full non-passive value in the projection.
    const repsViable = !snapshot.spouseWorks;
    const postRentalSnapshot: FinancialSnapshot = {
      ...snapshot,
      currentlyOwnsRental:  true,
      rentalPropertyValue,
      repsQualified: repsViable ? true : (snapshot.repsQualified ?? undefined),
    };
    const postRentalResults = evaluateAll(postRentalSnapshot);
    // Sum value from strategies that are newly valuable (previously NOT_APPLICABLE or $0).
    rentalTaxUnlockAnnualValue = postRentalResults
      .filter(r => {
        const current = strategyResults.find(c => c.id === r.id);
        return (r.estimatedAnnualValue ?? 0) > 0 &&
               (current?.estimatedAnnualValue ?? 0) === 0;
      })
      .reduce((sum, r) => sum + (r.estimatedAnnualValue ?? 0), 0);
  }

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

  // Rental tax unlock tracking: effectiveDeployableCapital increases the year
  // after the first rental is acquired.
  let effectiveDeployableCapital = deployableCapitalPerYear;
  let rentalAcquiredYear = -1;         // year the first rental is acquired (1-based)
  let postRentalTaxInjected = false;   // ensures we only inject once

  /** Digital products / content business growth model. */
  const ZERO_COST_GROWTH_STEP     = 1_000;   // +$1k/mo per growth event
  const ZERO_COST_INCOME_CAP      = 15_000;  // capped at $15k/mo
  const ZERO_COST_GROWTH_MONTHS   = 18;      // growth event every 18 months

  // Index fund compounding — track a single growing balance rather than
  // treating each acquisition as an independent fixed-income asset.
  let indexFundBalance = 0;  // total capital ever deployed into index funds

  // Separate zero-cost assets (digital_products) from capital-required assets.
  const zeroCostEligible = eligibleConfigs.filter(c => c.downPayment === 0);
  const capitalEligible  = eligibleConfigs.filter(c => c.downPayment > 0 && c.id !== 'index_investing');
  const indexInvestingCfg = ASSET_CONFIGS.find(c => c.id === 'index_investing')!;
  const wantsIndexInvesting = eligibleConfigs.some(c => c.id === 'index_investing');
  // Fallback: if user selected only index investing and nothing else, use it as capital asset
  const capitalAssets = capitalEligible.length > 0 ? capitalEligible
    : wantsIndexInvesting ? []   // handled separately below
    : [indexInvestingCfg];       // true fallback when nothing selected

  // Track launched zero-cost assets: id → { launchYear, growthCount, currentIncome, cfg }
  const launchedZeroCost = new Map<string, {
    launchYear: number; growthCount: number; currentIncome: number; cfg: AssetConfig;
  }>();

  // If already free
  if (gapMonthly <= 0) {
    projectedFreedomYear = currentYear;
    yearsToFreedom = 0;
  } else {
    for (let year = 1; year <= 20; year++) {
      // Capital deployment: base + spouse business contribution + after-tax bonus growth
      const spouseBoost = incomeAssumptions
        ? (year >= 3 ? incomeAssumptions.spouseBusinessMonthly36 : incomeAssumptions.spouseBusinessMonthly12) * 12
        : 0;
      const bonusRate = incomeAssumptions?.bonusGrowthRate ?? 0;
      const bonusBoost = bonusRate > 0
        ? snapshot.bonusTakenAsCash * (Math.pow(1 + bonusRate, year) - 1) * 0.67
        : 0;

      // ── Rental tax unlock: inject the year AFTER first rental is acquired ──
      // effectiveDeployableCapital is increased here so it's included in the
      // capitalAccumulated addition below — no double-counting.
      let taxUnlockThisYear = false;
      if (!postRentalTaxInjected && rentalAcquiredYear >= 0 &&
          year === rentalAcquiredYear + 1 && rentalTaxUnlockAnnualValue > 0) {
        postRentalTaxInjected = true;
        taxUnlockThisYear = true;
        effectiveDeployableCapital += rentalTaxUnlockAnnualValue;
      }

      capitalAccumulated += effectiveDeployableCapital + spouseBoost + bonusBoost;
      let yearAcquired = false;
      let capitalAssetAcquiredThisYear = false;  // set in step 3; gates the index sweep in step 4

      // Debug: trace capital state at the start of each year
      const _nextAssetDbg = capitalAssets.length > 0
        ? capitalAssets[capitalCycleIndex % capitalAssets.length]
        : null;
      console.log(
        `[roadmap] year=${year}` +
        ` cycleIdx=${capitalCycleIndex}` +
        ` capitalAccumulated=${Math.round(capitalAccumulated)}` +
        ` effectiveDeployable=${Math.round(effectiveDeployableCapital)}` +
        ` evaluating=${_nextAssetDbg ? _nextAssetDbg.id + '(dp=$' + _nextAssetDbg.downPayment + ')' : 'index-only'}`,
      );

      // Emit the tax unlock roadmap row (after capital accumulation so ordering is clean)
      if (taxUnlockThisYear) {
        roadmap.push({
          year,
          calendarYear: currentYear + year,
          action: `Real estate tax strategies unlocked: +${fmt(rentalTaxUnlockAnnualValue)}/yr`,
          assetType: 'tax_unlock',
          capitalDeployed: 0,
          estimatedMonthlyIncomeAdded: 0,
          cumulativeMonthlyIncome,
          remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
        });
        yearAcquired = true;
      }

      // ── 0. Business income boosts (year 1 and year 3) ─────────────────────
      if (incomeAssumptions) {
        if (year === 1) {
          const currentBiz = snapshot.businessRevenue / 12;
          const delta = Math.max(0, incomeAssumptions.businessMonthly12 - currentBiz);
          if (delta > 0) {
            cumulativeMonthlyIncome += delta;
            roadmap.push({
              year,
              calendarYear: currentYear + year,
              action: `Business income grows to ${fmt(incomeAssumptions.businessMonthly12)}/mo`,
              assetType: 'business_growth',
              capitalDeployed: 0,
              estimatedMonthlyIncomeAdded: delta,
              cumulativeMonthlyIncome,
              remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
            });
            yearAcquired = true;
          }
        }
        if (year === 3) {
          const delta = Math.max(0, incomeAssumptions.businessMonthly36 - incomeAssumptions.businessMonthly12);
          if (delta > 0) {
            cumulativeMonthlyIncome += delta;
            roadmap.push({
              year,
              calendarYear: currentYear + year,
              action: `Business income grows to ${fmt(incomeAssumptions.businessMonthly36)}/mo`,
              assetType: 'business_growth',
              capitalDeployed: 0,
              estimatedMonthlyIncomeAdded: delta,
              cumulativeMonthlyIncome,
              remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
            });
            yearAcquired = true;
          }
        }
        if (cumulativeMonthlyIncome >= freedomTarget) {
          projectedFreedomYear = currentYear + year;
          yearsToFreedom = year;
          break;
        }
      }

      // ── 1. Launch zero-cost assets (each only once, in year 1 of the plan) ──
      for (const cfg of zeroCostEligible) {
        if (!launchedZeroCost.has(cfg.id)) {
          const income = (incomeAssumptions && cfg.id === 'digital_products')
            ? incomeAssumptions.digitalProductsMonthly12
            : cfg.baseMonthlyIncome;
          cumulativeMonthlyIncome += income;
          launchedZeroCost.set(cfg.id, { launchYear: year, growthCount: 0, currentIncome: income, cfg });
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
      // Every ZERO_COST_GROWTH_MONTHS (18) months after launch, income grows by
      // ZERO_COST_GROWTH_STEP up to the asset's income cap.
      // We work in months (year * 12) to support the non-integer 18-month interval.
      for (const [id, state] of launchedZeroCost) {
        const assetCap = (id === 'digital_products' && incomeAssumptions)
          ? incomeAssumptions.digitalProductsPeak
          : ZERO_COST_INCOME_CAP;
        const monthsSinceLaunch = (year - state.launchYear) * 12;
        const nextGrowthAtMonth = (state.growthCount + 1) * ZERO_COST_GROWTH_MONTHS;
        const isDueForGrowth    = monthsSinceLaunch >= nextGrowthAtMonth;
        if (isDueForGrowth && state.currentIncome < assetCap) {
          const growth = Math.min(ZERO_COST_GROWTH_STEP, assetCap - state.currentIncome);
          cumulativeMonthlyIncome += growth;
          state.currentIncome     += growth;
          state.growthCount       += 1;
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
      const rentalDelayYears = incomeAssumptions?.firstRentalDelayYears ?? 0;
      let acquired = true;
      while (acquired && capitalAssets.length > 0) {
        acquired = false;
        // Advance past any rentals that are still in their delay window
        let skipped = 0;
        while (skipped < capitalAssets.length) {
          const c = capitalAssets[capitalCycleIndex % capitalAssets.length];
          const isRental = c.id === 'long_term_rental' || c.id === 'short_term_rental';
          if (isRental && year <= rentalDelayYears) { capitalCycleIndex++; skipped++; }
          else break;
        }
        if (skipped >= capitalAssets.length) break; // all assets are delayed rentals this year

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
          capitalAssetAcquiredThisYear = true;
          // Track first rental acquisition so we can inject the tax unlock the following year
          if (rentalAcquiredYear < 0 &&
              (cfg.id === 'long_term_rental' || cfg.id === 'short_term_rental')) {
            rentalAcquiredYear = year;
          }
          if (cumulativeMonthlyIncome >= freedomTarget) break;
        }
      }
      if (cumulativeMonthlyIncome >= freedomTarget) {
        projectedFreedomYear = currentYear + year;
        yearsToFreedom = year;
        break;
      }

      // ── 4. Index fund compounding ────────────────────────────────────────
      // Sweep remaining capital to index in two cases only:
      //   (a) A capital asset was acquired THIS year — the remainder is genuine excess.
      //   (b) No capital assets are in the cycle — index is the only destination.
      // Any other year (still saving up), preserve capitalAccumulated so it
      // accumulates toward the next capital-asset down payment across years.
      // This interleaves rentals and index fund naturally: buy rental → sweep excess
      // to index → save again → buy next rental → sweep excess → repeat.
      const sweepToIndexThisYear = wantsIndexInvesting && capitalAccumulated > 0 &&
        (capitalAssets.length === 0 || capitalAssetAcquiredThisYear);

      if (sweepToIndexThisYear) {
        const sweepAmount = capitalAccumulated;
        const previousIndexIncome = (indexFundBalance * 0.07) / 12;
        indexFundBalance   += sweepAmount;
        capitalAccumulated  = 0;
        const newIndexIncome = (indexFundBalance * 0.07) / 12;
        const incomeAdded    = newIndexIncome - previousIndexIncome;
        cumulativeMonthlyIncome += incomeAdded;
        roadmap.push({
          year,
          calendarYear: currentYear + year,
          action: `Index Fund balance grows to ${fmt(indexFundBalance)} → ${fmt(newIndexIncome)}/mo`,
          assetType: 'index_investing',
          capitalDeployed: sweepAmount,
          estimatedMonthlyIncomeAdded: Math.round(incomeAdded),
          cumulativeMonthlyIncome,
          remainingGap: Math.max(0, freedomTarget - cumulativeMonthlyIncome),
        });
        yearAcquired = true;
        if (cumulativeMonthlyIncome >= freedomTarget) {
          projectedFreedomYear = currentYear + year;
          yearsToFreedom = year;
          break;
        }
      }

      // ── 5. Nothing acquired — show capital-building progress ─────────────
      if (!yearAcquired) {
        const nextCfg = capitalAssets.length > 0
          ? capitalAssets[capitalCycleIndex % capitalAssets.length]
          : indexInvestingCfg;
        roadmap.push({
          year,
          calendarYear: currentYear + year,
          action: capitalAssets.length > 0
            ? `Building toward ${nextCfg.title} (${fmt(capitalAccumulated)} of ${fmt(nextCfg.downPayment)} saved)`
            : `Accumulating capital for index fund deployment (${fmt(capitalAccumulated)} this year)`,
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
      rentalTaxUnlockAnnualValue: rentalTaxUnlockAnnualValue > 0 ? rentalTaxUnlockAnnualValue : undefined,
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

  // Retire all previous plans for this user
  await sb.from('generated_plans').update({ is_current: false }).eq('user_id', userId);

  // Insert new current plan
  const { error } = await sb.from('generated_plans').insert({
    user_id:                     userId,
    is_current:                  true,
    freedom_gap:                 plan.freedomGap,
    phases:                      plan.phases,
    tax_strategy_stack:          plan.taxStrategyStack,
    asset_roadmap:               plan.assetRoadmap,
    deployable_capital_per_year: plan.deployableCapitalPerYear,
    ai_narrative:                null,
    projected_freedom_date:      projectedFreedomDate,
  });

  if (error) throw new Error(`savePlan failed: ${error.message}`);
}

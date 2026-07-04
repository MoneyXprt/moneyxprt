// ─── Freedom Score — 0 to 100, increases as user executes their plan ──────────

export interface FreedomScoreInputs {
  hasFreedomProfile:      boolean;
  hasFreedomNumber:       boolean;
  hasSnapshot:            boolean;
  hasAssetPreferences:    boolean;
  hasConstraints:         boolean;
  activeStrategies:       number;
  implementedStrategies:  number;
  monthlyRentalIncome:    number;
  monthlyDividendIncome:  number;
  currentPassiveMonthly:  number;
  freedomNumberMonthly:   number;
  completedActions:       number;
  thisWeekActionsTotal:   number;
  thisWeekActionsCompleted: number;
}

export interface FreedomScoreBreakdown {
  plan:       number; // 0–20
  strategies: number; // 0–30
  assets:     number; // 0–30
  execution:  number; // 0–20
  total:      number; // 0–100
}

export function calculateFreedomScore(inputs: FreedomScoreInputs): FreedomScoreBreakdown {
  // ── Plan completion (20 points) ────────────────────────────────────────────
  let plan = 0;
  if (inputs.hasFreedomProfile)   plan += 4;
  if (inputs.hasFreedomNumber)    plan += 4;
  if (inputs.hasSnapshot)         plan += 4;
  if (inputs.hasAssetPreferences) plan += 4;
  if (inputs.hasConstraints)      plan += 4;

  // ── Tax strategy activation (30 points) ───────────────────────────────────
  let strategies = 0;
  if (inputs.activeStrategies > 0) {
    const perStrategy = 30 / inputs.activeStrategies;
    strategies = Math.min(30, Math.round(inputs.implementedStrategies * perStrategy));
  }

  // ── Asset building (30 points) ────────────────────────────────────────────
  let assets = 0;
  const hasFirstAsset =
    inputs.monthlyRentalIncome > 0 || inputs.monthlyDividendIncome > 500;
  if (hasFirstAsset) assets += 10;
  if (inputs.freedomNumberMonthly > 0) {
    const pct = inputs.currentPassiveMonthly / inputs.freedomNumberMonthly;
    if (pct >= 0.25) assets += 10;
    if (pct >= 0.50) assets += 10;
  }

  // ── Execution consistency (20 points) ─────────────────────────────────────
  let execution = 0;
  if (inputs.completedActions >= 1) execution += 5;
  if (inputs.completedActions >= 3) execution += 5;
  if (inputs.completedActions >= 5) execution += 5;
  if (
    inputs.thisWeekActionsTotal > 0 &&
    inputs.thisWeekActionsCompleted >= inputs.thisWeekActionsTotal
  ) execution += 5;

  const total = Math.min(100, plan + strategies + assets + execution);
  return { plan, strategies, assets, execution, total };
}

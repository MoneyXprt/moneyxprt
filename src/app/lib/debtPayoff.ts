export type PayoffStrategy = 'snowball' | 'avalanche';

export interface RankableDebt {
  id: string;
  currentBalance: number;
  interestRate: number;
  isActive: boolean;
}

export interface PayoffRankResult {
  id: string;
  payoffOrder: number | null; // null for inactive (paid-off) debts — they drop out of ranking
}

/**
 * Ranks active debts for payoff order. Inactive debts always get payoffOrder: null and
 * are excluded from ranking, but are still returned so callers can write a full update
 * batch without a separate filter step.
 *
 *   snowball  (default) — smallest current_balance first (fastest wins, builds momentum)
 *   avalanche            — highest interest_rate first (minimizes total interest paid)
 */
export function computeDebtPayoffOrder(
  debts: RankableDebt[],
  strategy: PayoffStrategy = 'snowball',
): PayoffRankResult[] {
  const active   = debts.filter(d => d.isActive);
  const inactive = debts.filter(d => !d.isActive);

  const sorted = [...active].sort((a, b) =>
    strategy === 'snowball'
      ? a.currentBalance - b.currentBalance
      : b.interestRate - a.interestRate,
  );

  return [
    ...sorted.map((d, i) => ({ id: d.id, payoffOrder: i + 1 })),
    ...inactive.map(d => ({ id: d.id, payoffOrder: null })),
  ];
}

// ─── Payoff timeline simulation (for the freedom-date projection) ─────────────

export interface SimulatableDebt {
  id: string;
  name: string;
  currentBalance: number;
  interestRate: number;
  isActive: boolean;
}

export interface DebtPayoffEvent {
  year: number; // 1-based year in the projection
  debtId: string;
  debtName: string;
}

export interface DebtPayoffSimulation {
  /** 0 if already debt-free (or no active debts). Capped at capYears if it doesn't clear in time. */
  yearsToPayoff: number;
  /** One entry per debt, in the year its balance reaches 0. */
  events: DebtPayoffEvent[];
  /** Total remaining balance across all debts at the end of each simulated year, index 0 = end of year 1. */
  remainingByYear: number[];
  totalStartingDebt: number;
}

/**
 * Simulates paying off active debts with a fixed snowball order (smallest balance
 * first, established once via computeDebtPayoffOrder at the start and not
 * re-evaluated as balances change) — standard debt-snowball methodology: commit to
 * an order, and roll each cleared debt's payment capacity into the next debt in line.
 *
 * annualPaydownCapacity is applied as the full extra-payment pool each year — this
 * function does not separately model minimum payments (the caller's capacity figure
 * is assumed to already be net of them, matching computeMonthlyDeployable's
 * treatment) or interest accrual during the payoff window. Both are simplifications
 * consistent with the rest of the asset-roadmap projection, which likewise doesn't
 * model mortgage amortization or interest on acquired assets.
 */
export function simulateDebtSnowballPayoff(
  debts: SimulatableDebt[],
  annualPaydownCapacity: number,
  capYears = 20,
): DebtPayoffSimulation {
  const active = debts.filter(d => d.isActive && d.currentBalance > 0);
  const totalStartingDebt = active.reduce((sum, d) => sum + d.currentBalance, 0);

  if (active.length === 0) {
    return { yearsToPayoff: 0, events: [], remainingByYear: [], totalStartingDebt: 0 };
  }

  const order = computeDebtPayoffOrder(
    active.map(d => ({ id: d.id, currentBalance: d.currentBalance, interestRate: d.interestRate, isActive: true })),
    'snowball',
  );
  const orderedIds = order
    .filter((r): r is { id: string; payoffOrder: number } => r.payoffOrder != null)
    .sort((a, b) => a.payoffOrder - b.payoffOrder)
    .map(r => r.id);

  const remaining = new Map(active.map(d => [d.id, d.currentBalance]));
  const nameById  = new Map(active.map(d => [d.id, d.name]));
  const events: DebtPayoffEvent[] = [];
  const remainingByYear: number[] = [];
  let queueIndex = 0;

  for (let year = 1; year <= capYears; year++) {
    let capacityThisYear = annualPaydownCapacity;
    while (capacityThisYear > 0 && queueIndex < orderedIds.length) {
      const id = orderedIds[queueIndex];
      const bal = remaining.get(id)!;
      const payment = Math.min(bal, capacityThisYear);
      const newBal = bal - payment;
      remaining.set(id, newBal);
      capacityThisYear -= payment;
      if (newBal <= 0) {
        events.push({ year, debtId: id, debtName: nameById.get(id)! });
        queueIndex++;
      } else {
        break; // this debt still has balance left; capacity exhausted for the year
      }
    }

    const totalRemaining = [...remaining.values()].reduce((sum, v) => sum + v, 0);
    remainingByYear.push(Math.max(0, totalRemaining));

    if (queueIndex >= orderedIds.length) {
      return { yearsToPayoff: year, events, remainingByYear, totalStartingDebt };
    }
  }

  return { yearsToPayoff: capYears, events, remainingByYear, totalStartingDebt };
}

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

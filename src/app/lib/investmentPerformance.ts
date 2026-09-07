export interface InvestmentCheckIn {
  id: string;
  portfolioValue: number;
  cumulativeContributions: number;
  observedOn: string;
}

export interface ReturnComparison {
  portfolioReturn: number | null;
  benchmarkReturn: number | null;
  difference: number | null;
}

/** Calculates a cash-flow-adjusted portfolio return between the first and latest check-in. */
export function calculateReturnComparison(
  checkIns: readonly InvestmentCheckIn[],
  benchmarkStart: number | null,
  benchmarkEnd: number | null,
): ReturnComparison {
  if (checkIns.length < 2) return { portfolioReturn: null, benchmarkReturn: null, difference: null };
  const first = checkIns[0];
  const last = checkIns.at(-1)!;
  const contributionChange = last.cumulativeContributions - first.cumulativeContributions;
  const portfolioReturn = first.portfolioValue > 0
    ? (last.portfolioValue - first.portfolioValue - contributionChange) / first.portfolioValue
    : null;
  const benchmarkReturn = benchmarkStart && benchmarkEnd && benchmarkStart > 0
    ? (benchmarkEnd - benchmarkStart) / benchmarkStart
    : null;
  return { portfolioReturn, benchmarkReturn, difference: portfolioReturn !== null && benchmarkReturn !== null ? portfolioReturn - benchmarkReturn : null };
}

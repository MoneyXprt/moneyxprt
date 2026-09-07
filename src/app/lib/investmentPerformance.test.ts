import { describe, expect, it } from 'vitest';
import { calculateReturnComparison } from './investmentPerformance';

describe('calculateReturnComparison', () => {
  it('removes new contributions before calculating the portfolio return', () => {
    const result = calculateReturnComparison([
      { id: 'a', portfolioValue: 10_000, cumulativeContributions: 10_000, observedOn: '2026-01-01' },
      { id: 'b', portfolioValue: 16_000, cumulativeContributions: 15_000, observedOn: '2026-06-01' },
    ], 5_000, 5_250);
    expect(result).toEqual({ portfolioReturn: 0.1, benchmarkReturn: 0.05, difference: 0.05 });
  });
});

import { describe, expect, it } from 'vitest';
import { computeDebtPayoffOrder, simulateDebtSnowballPayoff } from './debtPayoff';

const debts = [
  { id: 'large', name: 'Large', currentBalance: 10_000, interestRate: 5, isActive: true },
  { id: 'small', name: 'Small', currentBalance: 2_000, interestRate: 20, isActive: true },
  { id: 'paid', name: 'Paid', currentBalance: 0, interestRate: 0, isActive: false },
];

describe('debt payoff', () => {
  it('ranks debts by the chosen payoff strategy and excludes inactive debt', () => {
    expect(computeDebtPayoffOrder(debts, 'snowball')).toEqual([
      { id: 'small', payoffOrder: 1 }, { id: 'large', payoffOrder: 2 }, { id: 'paid', payoffOrder: null },
    ]);
    expect(computeDebtPayoffOrder(debts, 'avalanche')[0]).toEqual({ id: 'small', payoffOrder: 1 });
  });

  it('applies surplus capacity to the next debt in the same year', () => {
    const result = simulateDebtSnowballPayoff(debts, 5_000);
    expect(result).toMatchObject({ yearsToPayoff: 3, totalStartingDebt: 12_000, remainingByYear: [7_000, 2_000, 0] });
    expect(result.events).toEqual([
      { year: 1, debtId: 'small', debtName: 'Small' },
      { year: 3, debtId: 'large', debtName: 'Large' },
    ]);
  });

  it('returns an empty payoff plan when no active balances remain', () => {
    expect(simulateDebtSnowballPayoff([{ ...debts[2] }], 5_000)).toMatchObject({ yearsToPayoff: 0, totalStartingDebt: 0, events: [] });
  });
});

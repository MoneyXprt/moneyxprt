/**
 * Health Savings Account — IRC §§ 223, 106, 213
 *
 * The HSA is the only account in the U.S. tax code that is triple-tax-advantaged:
 *   1. Contributions are pre-tax (or deductible) — reduces taxable income now.
 *   2. Growth is tax-free — dividends, interest, and capital gains accumulate
 *      without annual taxation.
 *   3. Withdrawals are tax-free when used for qualified medical expenses.
 *
 * After age 65, the account behaves like a Traditional IRA — withdrawals for
 * any purpose are taxed at ordinary rates but penalty-free, making unspent HSA
 * balances a de-facto supplemental retirement account.
 *
 * Eligibility requires enrollment in a qualifying High-Deductible Health Plan
 * (HDHP). 2026 family contribution limit: $8,750.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getMarginalRate,
  getTaxableIncome,
  CONTRIBUTION_LIMITS,
} from '../taxConstants2026';

const ID   = 'hsa';
const NAME = 'Health Savings Account (Triple Tax Advantage)';

export const hsa: Strategy = {
  id: ID,
  name: NAME,
  category: 'retirement',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'retirement',
    };

    if (!s.hasHsaAvailable) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'An HSA requires enrollment in a qualifying High-Deductible Health Plan (HDHP). ' +
          'Your current health plan does not appear to include HSA eligibility.',
        unlockCondition:
          'Enroll in a High-Deductible Health Plan (HDHP) that includes HSA eligibility, ' +
          'typically during your employer\'s open enrollment period or after a qualifying ' +
          'life event. Confirm HSA eligibility with your plan administrator before contributing.',
        blockedBy: 'hasHsaAvailable',
      };
    }

    const taxableIncome        = getTaxableIncome(s);
    const combinedMarginalRate = getMarginalRate(taxableIncome, s.filingStatus, s.state);
    const limit                = CONTRIBUTION_LIMITS.hsaFamily;
    const estimatedAnnualValue = Math.round(limit * combinedMarginalRate);

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `The HSA is the only triple-tax-advantaged account in the U.S. tax code: ` +
        `contributions reduce taxable income now, growth compounds tax-free, and ` +
        `withdrawals for qualified medical expenses are completely tax-free. ` +
        `The 2026 family contribution limit is $${limit.toLocaleString()}. ` +
        `At your combined ${(combinedMarginalRate * 100).toFixed(1)}% marginal rate ` +
        `(federal + ${s.state}), maxing the HSA saves ~$${estimatedAnnualValue.toLocaleString()} ` +
        `in taxes this year. Any balance not spent on medical costs carries forward ` +
        `indefinitely — after age 65, unspent funds can be withdrawn for any purpose ` +
        `at ordinary income rates, functioning as a supplemental retirement account.`,
    };
  },
};

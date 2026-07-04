/**
 * Augusta Rule — IRC §280A(g)
 *
 * A homeowner may rent their personal residence to their own business for up
 * to 14 days per year. Rental income received by the homeowner is completely
 * excluded from gross income; the business deducts the payments as an
 * ordinary business expense. Net effect: income shifts from the business
 * (taxable) to the homeowner (tax-free).
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getMarginalRate,
  getTaxableIncome,
  AUGUSTA_RULE_MAX_DAYS,
  AUGUSTA_RULE_DAILY_RATE,
} from '../taxConstants2026';

const ID   = 'augusta-rule';
const NAME = 'Augusta Rule (IRC §280A)';

export const augustaRule: Strategy = {
  id: ID,
  name: NAME,
  category: 'tax',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category' | 'valueType'> = {
      id: ID,
      name: NAME,
      category: 'tax',
      valueType: 'cash',
    };

    if (!s.hasBusinessEntity) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'The Augusta Rule requires a legitimate business entity to rent your personal ' +
          'residence as a meeting or event venue. No business entity is currently on file.',
        unlockCondition:
          'Open a business entity (LLC, S-Corp, or sole proprietorship with a separate EIN) ' +
          'and document at least one legitimate business use of your home.',
        blockedBy: 'hasBusinessEntity',
      };
    }

    const taxableIncome = getTaxableIncome(s);
    const marginalRate  = getMarginalRate(taxableIncome, s.filingStatus, s.state);
    const annualRental  = AUGUSTA_RULE_DAILY_RATE * AUGUSTA_RULE_MAX_DAYS;
    const estimatedAnnualValue = Math.round(annualRental * marginalRate);

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `Your business can pay you $${AUGUSTA_RULE_DAILY_RATE.toLocaleString()}/day to rent your ` +
        `home for up to ${AUGUSTA_RULE_MAX_DAYS} days per year ($${annualRental.toLocaleString()} ` +
        `total). The rental income is tax-free to you as homeowner (§280A(g) exclusion), and ` +
        `fully deductible to the business. At your ${(marginalRate * 100).toFixed(0)}% marginal ` +
        `rate that is approximately $${estimatedAnnualValue.toLocaleString()} in annual tax savings.`,
    };
  },
};

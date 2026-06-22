/**
 * S-Corp Election — IRC §§ 1361–1379; IRS Form 2553
 *
 * By default, a single-member LLC or sole proprietorship pays self-employment
 * (SE) tax — 15.3% — on 100% of net profit. Electing S-Corp status changes
 * the tax character of that income:
 *
 *   Reasonable salary  → subject to FICA payroll tax (same 15.3% split
 *                         equally between employer and employee shares).
 *   Distributions      → NOT subject to SE/FICA tax at all.
 *
 * The IRS requires owners to pay themselves a "reasonable" W-2 salary before
 * taking distributions. A commonly-accepted rule of thumb: ~60% salary /
 * 40% distribution. The distribution portion escapes the 15.3% SE tax
 * entirely, producing the savings.
 *
 * Cost considerations — why the $50k threshold exists:
 *   S-Corp requires a separate payroll run (payroll service ~$500–$2,000/yr),
 *   additional state registration/compliance fees, and potentially a separate
 *   corporate tax return (Form 1120-S, ~$500–$1,500 in CPA fees). These fixed
 *   costs are only worth bearing once the SE-tax savings exceed them, which
 *   typically requires ~$50,000+ in net business revenue.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  SE_TAX_RATE,
  SCORP_REVENUE_THRESHOLD,
  SCORP_SALARY_FRACTION,
  SCORP_DISTRIBUTION_FRACTION,
} from '../taxConstants2026';

const ID   = 's-corp-election';
const NAME = 'S-Corp Election (SE Tax Reduction)';

export const sCorpElection: Strategy = {
  id: ID,
  name: NAME,
  category: 'businessStructure',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'businessStructure',
    };

    // Pre-compute value at current revenue regardless of state so we can
    // show the "goal" number even when LOCKED.
    const distributionPortion  = s.businessRevenue * SCORP_DISTRIBUTION_FRACTION;
    const estimatedSavings     = Math.round(distributionPortion * SE_TAX_RATE);
    const salaryDisplay        = Math.round(s.businessRevenue * SCORP_SALARY_FRACTION).toLocaleString();
    const distDisplay          = Math.round(distributionPortion).toLocaleString();

    // ── LOCKED: revenue below the cost-effectiveness threshold ──────────────
    if (s.businessRevenue < SCORP_REVENUE_THRESHOLD) {
      // Show value at threshold so the user can see what they're growing toward.
      const thresholdDistribution  = SCORP_REVENUE_THRESHOLD * SCORP_DISTRIBUTION_FRACTION;
      const thresholdSavings       = Math.round(thresholdDistribution * SE_TAX_RATE);

      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: estimatedSavings,  // current-revenue value as a progress indicator
        reason:
          `S-Corp election generates SE-tax savings on the distribution portion of ` +
          `business income, but the fixed compliance costs (separate payroll, Form 1120-S ` +
          `filing, state registration) typically run $1,000–$3,500/year. At your current ` +
          `business revenue ($${s.businessRevenue.toLocaleString()}), estimated savings ` +
          `($${estimatedSavings.toLocaleString()}/yr) do not yet cover those costs. ` +
          `At the $${SCORP_REVENUE_THRESHOLD.toLocaleString()} threshold, savings reach ` +
          `~$${thresholdSavings.toLocaleString()}/yr — the point where it typically pencils out.`,
        unlockCondition:
          `Unlocks when business net revenue exceeds ~$${SCORP_REVENUE_THRESHOLD.toLocaleString()}. ` +
          `Below that, S-Corp payroll and compliance costs typically outweigh the savings.`,
        blockedBy: 'businessRevenue',
      };
    }

    // ── ACTIVE ───────────────────────────────────────────────────────────────
    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue: estimatedSavings,
      reason:
        `Electing S-Corp status allows you to split your $${s.businessRevenue.toLocaleString()} ` +
        `business revenue into a reasonable W-2 salary (~$${salaryDisplay}, ${(SCORP_SALARY_FRACTION * 100).toFixed(0)}%) ` +
        `and owner distributions (~$${distDisplay}, ${(SCORP_DISTRIBUTION_FRACTION * 100).toFixed(0)}%). ` +
        `The salary portion is subject to FICA/payroll tax as usual. The distribution ` +
        `portion is completely exempt from the 15.3% self-employment tax — saving ` +
        `~$${estimatedSavings.toLocaleString()}/year. ` +
        `You'll need to run a payroll (W-2 to yourself), file Form 1120-S annually, ` +
        `and meet any state-level S-Corp registration requirements. ` +
        `Net of compliance costs (~$1,000–$3,500/yr), this strategy is clearly cost-positive ` +
        `at your revenue level. File IRS Form 2553 by March 15 to elect for the current year.`,
    };
  },
};

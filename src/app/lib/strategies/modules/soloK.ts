/**
 * Solo 401(k) / SEP IRA — IRC §§ 401(a), 408(k), 415
 *
 * Any taxpayer with self-employment income (sole proprietor, single-member LLC,
 * S-Corp owner, or 1099 contractor) can establish a Solo 401(k) or SEP IRA and
 * make two tiers of contributions:
 *
 *   Employee elective deferral — up to $24,500 (same limit as a W-2 401k;
 *   can be pre-tax or Roth inside a Solo 401k).
 *
 *   Employer profit-sharing — up to 25% of net self-employment income
 *   (after the ½ SE-tax deduction), subject to the §415 overall limit
 *   of $70,000 for 2026.
 *
 * Combined, the two tiers allow far larger retirement contributions than a
 * standard W-2 employee can make, directly reducing taxable income by the
 * full contribution amount.
 *
 * SEP IRA is simpler to open but is employer-only (no employee Roth option).
 * Solo 401(k) is more flexible but requires annual Form 5500-EZ once assets
 * exceed $250,000.
 *
 * Value estimate here focuses on the employer profit-sharing tier — the
 * incremental amount over the standard W-2 401k limit that self-employment
 * uniquely enables.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getMarginalRate,
  getTaxableIncome,
  CONTRIBUTION_LIMITS,
  SE_TAX_DEDUCTIBLE_FRACTION,
} from '../taxConstants2026';

const ID   = 'solo-k';
const NAME = 'Solo 401(k) / SEP IRA (Self-Employment Retirement)';

/**
 * Employer profit-sharing is calculated on net SE earnings after the
 * ½ SE-tax deduction and the contribution itself. The effective rate on
 * gross self-employment income resolves to ≈20% (not 25%), but the IRS
 * allows using 25% of net-after-deduction. We apply SE_TAX_DEDUCTIBLE_FRACTION
 * to approximate net earnings, then take 25%.
 */
const EMPLOYER_CONTRIBUTION_RATE = 0.25;

export const soloK: Strategy = {
  id: ID,
  name: NAME,
  category: 'retirement',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'retirement',
    };

    const selfEmploymentIncome = s.income1099 + s.businessRevenue;

    // ── No self-employment income → LOCKED ───────────────────────────────────
    if (selfEmploymentIncome <= 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'A Solo 401(k) and SEP IRA both require self-employment income. ' +
          'Neither 1099 income nor business revenue is currently recorded.',
        unlockCondition:
          'Generate 1099 or business income (consulting, freelance, rental, or ' +
          'any sole-proprietor / LLC activity) to become eligible.',
        blockedBy: 'income1099 or businessRevenue',
      };
    }

    // ── Compute the employer profit-sharing contribution (the incremental value) ─
    // Net SE earnings ≈ gross × SE_TAX_DEDUCTIBLE_FRACTION (accounts for ½ SE-tax deduction)
    const netSEEarnings           = selfEmploymentIncome * SE_TAX_DEDUCTIBLE_FRACTION;
    const employerContribution    = Math.min(
      netSEEarnings * EMPLOYER_CONTRIBUTION_RATE,
      CONTRIBUTION_LIMITS.sepIraMax - CONTRIBUTION_LIMITS.k401,  // headroom above employee deferral
    );
    const totalAllowable          = Math.min(
      CONTRIBUTION_LIMITS.k401 + employerContribution,
      CONTRIBUTION_LIMITS.sepIraMax,
    );

    const taxableIncome        = getTaxableIncome(s);
    const combinedMarginalRate = getMarginalRate(taxableIncome, s.filingStatus, s.state);
    const estimatedAnnualValue = Math.round(totalAllowable * combinedMarginalRate);

    const incomeSource = s.income1099 > 0 && s.businessRevenue > 0
      ? `1099 income ($${s.income1099.toLocaleString()}) and business revenue ($${s.businessRevenue.toLocaleString()})`
      : s.income1099 > 0
        ? `1099 income ($${s.income1099.toLocaleString()})`
        : `business revenue ($${s.businessRevenue.toLocaleString()})`;

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `Your ${incomeSource} qualifies you to open a Solo 401(k) or SEP IRA. ` +
        `You can contribute as both employee (up to $${CONTRIBUTION_LIMITS.k401.toLocaleString()} ` +
        `elective deferral) and employer (up to 25% of net self-employment earnings — ` +
        `≈$${Math.round(employerContribution).toLocaleString()} on your current income), ` +
        `for a combined contribution of up to ` +
        `$${Math.round(totalAllowable).toLocaleString()}/year. ` +
        `At your combined ${(combinedMarginalRate * 100).toFixed(1)}% marginal rate, ` +
        `that deduction is worth ~$${estimatedAnnualValue.toLocaleString()} in current-year ` +
        `tax savings. ` +
        `A Solo 401(k) is generally preferred over a SEP IRA when self-employment income ` +
        `is moderate, because the employee deferral tier allows larger contributions at ` +
        `lower income levels and supports a Roth election on the employee portion.`,
    };
  },
};

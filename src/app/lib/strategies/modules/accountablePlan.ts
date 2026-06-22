/**
 * Accountable Plan — IRC §§ 62(a)(2)(A), 274(d); Reg. §1.62-2
 *
 * An accountable plan is a formal employer reimbursement arrangement that
 * removes business expense reimbursements from both taxable income AND
 * self-employment tax, provided three conditions are met:
 *
 *   1. Business connection — expenses must have a legitimate business purpose.
 *   2. Substantiation — receipts and records within a reasonable time (typically
 *      60 days of incurring the expense).
 *   3. Return of excess — any advance beyond actual expenses must be returned
 *      within a reasonable time (typically 120 days).
 *
 * For a self-employed taxpayer or S-Corp owner, properly structured
 * reimbursements under an accountable plan flow out of the business completely:
 *   — Not income to the recipient (no W-2 or 1099).
 *   — Not subject to FICA/SE tax (15.3%).
 *   — Deductible by the business as an ordinary business expense.
 *
 * Common applications: mileage, home office, phone, internet, travel,
 * professional development, and equipment used for business.
 *
 * This module estimates the SE-tax savings on income currently being
 * reported as 1099 self-employment income that could instead be structured
 * as accountable plan reimbursements (i.e., the portion that represents
 * true expense passthrough rather than profit).
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import { SE_TAX_RATE, SE_TAX_DEDUCTIBLE_FRACTION } from '../taxConstants2026';

const ID   = 'accountable-plan';
const NAME = 'Accountable Plan (Business Expense Reimbursement)';

export const accountablePlan: Strategy = {
  id: ID,
  name: NAME,
  category: 'tax',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'tax',
    };

    // ── LOCKED: no 1099 income ───────────────────────────────────────────────
    if (s.income1099 <= 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'An accountable plan saves SE tax by converting reimbursable business ' +
          'expenses out of taxable self-employment income. No 1099 income is currently ' +
          'on file to apply this strategy against.',
        unlockCondition:
          'Generate 1099 or self-employment income. Any legitimate business expenses ' +
          'embedded in that income (mileage, home office, phone, travel, equipment) ' +
          'can then be restructured as accountable plan reimbursements.',
        blockedBy: 'income1099',
      };
    }

    // SE tax applies to net earnings × SE_TAX_DEDUCTIBLE_FRACTION
    // (the deductible fraction accounts for the ½ SE-tax deduction from gross)
    const netSEEarnings        = s.income1099 * SE_TAX_DEDUCTIBLE_FRACTION;
    const estimatedAnnualValue = Math.round(netSEEarnings * SE_TAX_RATE);

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `Your $${s.income1099.toLocaleString()} in 1099 income is currently subject to ` +
        `the full ${(SE_TAX_RATE * 100).toFixed(1)}% self-employment tax on net earnings ` +
        `(≈$${Math.round(netSEEarnings).toLocaleString()} after the ½ SE-tax deduction), ` +
        `costing ~$${estimatedAnnualValue.toLocaleString()}/year in SE tax alone. ` +
        `By establishing a formal accountable plan, legitimate business expenses — ` +
        `mileage ($0.70/mile in 2026), home office, phone, internet, travel, and equipment — ` +
        `are reimbursed by the business and excluded from your 1099 income entirely: ` +
        `no income tax, no SE tax. Requirements: document each expense with a receipt, ` +
        `record the business purpose, and return any unused advances within 120 days. ` +
        `The estimate above reflects the SE-tax savings if all $${s.income1099.toLocaleString()} ` +
        `were reclassified; in practice, only the legitimate expense portion qualifies — ` +
        `work with a CPA to identify what is reimbursable in your specific situation.`,
    };
  },
};

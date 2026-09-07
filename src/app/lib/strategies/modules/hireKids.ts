/**
 * Hire Your Children — IRC §§ 162, 3111(c)
 *
 * A parent who owns a business may employ their minor children and deduct
 * the wages as an ordinary business expense. The child pays no federal
 * income tax on wages up to their standard deduction ($14,600 for 2026).
 * In a sole proprietorship or single-member LLC (SMLLC) owned by one parent,
 * wages paid to children under 18 are also exempt from FICA. Combined,
 * this shifts income from the parent's high marginal rate to the child's
 * zero-rate bracket.
 *
 * Eligibility requirements:
 *   1. A qualifying business entity must exist.
 *   2. The child must perform real, age-appropriate services.
 *   3. Wages must be reasonable and documented.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getMarginalRate,
  getTaxableIncome,
  KID_STANDARD_DEDUCTION,
  FAMILY_PAYROLL_REVENUE_FRACTION,
} from '../taxConstants2026';

const ID   = 'hire-kids';
const NAME = 'Hire Your Children (Family Payroll)';

export const hireKids: Strategy = {
  id: ID,
  name: NAME,
  category: 'family',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category' | 'valueType'> = {
      id: ID,
      name: NAME,
      category: 'family',
      valueType: 'cash',
    };

    // ── Gate 1: business entity ─────────────────────────────────────────────
    if (!s.hasBusinessEntity) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'A business entity is required to employ your children. ' +
          'Without one there is no vehicle to pay legitimate, deductible wages.',
        unlockCondition:
          'Open a business entity (sole proprietorship, single-member LLC, or S-Corp). ' +
          'Note: FICA exemption for children under 18 applies only to sole props and ' +
          'parent-owned LLCs, not S-Corps — choose the structure that fits your situation.',
        blockedBy: 'hasBusinessEntity',
      };
    }

    // ── Gate 2: qualifying children ─────────────────────────────────────────
    if (s.dependentsUnder18 === 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason: 'No dependents under 18 are recorded on your profile.',
        unlockCondition:
          'Add dependents under 18. Each qualifying child can earn up to ' +
          `$${KID_STANDARD_DEDUCTION.toLocaleString()} tax-free from your business.`,
        blockedBy: 'dependentsUnder18',
      };
    }

    if (s.businessRevenue <= 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'A business is on file, but its current-year revenue has not been recorded.',
        unlockCondition:
          'Add actual business revenue before sizing a reasonable, deductible payroll amount.',
        blockedBy: 'businessRevenue',
      };
    }

    // ── Value calculation ────────────────────────────────────────────────────
    // Cap per-child wages at the lesser of:
    //   (a) KID_STANDARD_DEDUCTION — child's entire wage is sheltered from federal tax
    //   (b) the parent's conservative family-payroll budget (fraction of revenue per child)
    const payrollBudgetPerChild =
      (s.businessRevenue * FAMILY_PAYROLL_REVENUE_FRACTION) / s.dependentsUnder18;
    const wagePerChild = Math.min(KID_STANDARD_DEDUCTION, payrollBudgetPerChild);

    const taxableIncome        = getTaxableIncome(s);
    const marginalRate         = getMarginalRate(taxableIncome, s.filingStatus, s.state);
    const estimatedAnnualValue = Math.round(wagePerChild * marginalRate * s.dependentsUnder18);

    const wageDisplay   = Math.round(wagePerChild).toLocaleString();
    const savingsDisplay = estimatedAnnualValue.toLocaleString();
    const rateDisplay   = (marginalRate * 100).toFixed(0);
    const kidWord       = s.dependentsUnder18 === 1 ? 'child' : 'children';

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `You can pay each of your ${s.dependentsUnder18} ${kidWord} up to ` +
        `$${wageDisplay}/year for legitimate business work. ` +
        `The wages are fully deductible to your business, and each child owes ` +
        `zero federal income tax (below the $${KID_STANDARD_DEDUCTION.toLocaleString()} ` +
        `standard deduction). At your ${rateDisplay}% marginal rate, ` +
        `estimated annual savings: ~$${savingsDisplay}.`,
      evidenceRequirements: [
        'Age-appropriate duties and market-rate wage support',
        'Timesheets, payroll records, and payment trail',
      ],
    };
  },
};

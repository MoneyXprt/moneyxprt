/**
 * Home Office Deduction — IRC § 280A(c)
 *
 * A taxpayer who uses part of their home regularly and exclusively for
 * business may deduct expenses attributable to that space. Under the IRS
 * simplified method, the deduction is a flat $5 per square foot of the
 * dedicated space, up to 300 square feet — a maximum deduction of $1,500/yr.
 * No receipts or expense allocation required, but the space must still meet
 * the "regular and exclusive use" test: no personal use of any kind.
 *
 * The regular (actual-expense) method can yield a larger deduction by
 * allocating a percentage of actual home expenses (mortgage interest,
 * utilities, insurance, depreciation), but requires detailed recordkeeping.
 * Only the simplified method is modeled here.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';

const ID   = 'home-office-deduction';
const NAME = 'Home Office Deduction (Simplified Method)';

/** IRS simplified-method rate and square-footage cap (Rev. Proc. 2013-13). */
const SIMPLIFIED_RATE_PER_SQFT = 5;
const SIMPLIFIED_SQFT_CAP      = 300;

export const homeOfficeDeduction: Strategy = {
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

    // ── Gate 1: business entity ─────────────────────────────────────────────
    if (!s.hasBusinessEntity) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'The home office deduction requires a business to use the space for. ' +
          'No business entity is currently on file.',
        unlockCondition:
          'Open a business entity (sole proprietorship, single-member LLC, S-Corp, ' +
          'or partnership).',
        blockedBy: 'hasBusinessEntity',
      };
    }

    // ── Gate 2: dedicated space ──────────────────────────────────────────────
    if (!s.hasDedicatedHomeOffice) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'The home office deduction requires a space used regularly and exclusively ' +
          'for business — no personal use of any kind. No dedicated space is currently ' +
          'on file.',
        unlockCondition:
          'Set aside a room or clearly defined area of your home used only for business. ' +
          'A desk in a shared family room does not qualify — the IRS requires exclusive ' +
          'business use of the space.',
        blockedBy: 'hasDedicatedHomeOffice',
      };
    }

    // ── Gate 3: square footage recorded ──────────────────────────────────────
    if (s.homeOfficeSquareFootage <= 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'A dedicated home office space is on file, but its square footage has not ' +
          'been recorded yet — the simplified-method deduction is calculated directly ' +
          'from that figure.',
        unlockCondition: 'Enter the approximate square footage of your dedicated office space.',
        blockedBy: 'homeOfficeSquareFootage',
      };
    }

    // ── ACTIVE ────────────────────────────────────────────────────────────────
    const deductibleSqft       = Math.min(s.homeOfficeSquareFootage, SIMPLIFIED_SQFT_CAP);
    const estimatedAnnualValue = Math.round(deductibleSqft * SIMPLIFIED_RATE_PER_SQFT);

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `Your ${s.homeOfficeSquareFootage.toLocaleString()} sq ft dedicated office ` +
        `qualifies for the simplified-method deduction: $${SIMPLIFIED_RATE_PER_SQFT}/sq ft ` +
        `on up to ${SIMPLIFIED_SQFT_CAP} sq ft, for a deduction of ` +
        `$${estimatedAnnualValue.toLocaleString()}/yr` +
        (s.homeOfficeSquareFootage > SIMPLIFIED_SQFT_CAP
          ? ` (capped at the ${SIMPLIFIED_SQFT_CAP} sq ft simplified-method maximum — ` +
            'the actual-expense method may yield more for a larger space, but requires ' +
            'detailed recordkeeping).'
          : '.') +
        ' No receipts required, but the space must be used regularly and exclusively ' +
        'for business — any personal use disqualifies the deduction entirely.',
    };
  },
};

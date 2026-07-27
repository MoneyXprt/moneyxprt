/**
 * Startup Costs Deduction — IRC § 195
 *
 * A new business may immediately deduct up to $5,000 of costs incurred before
 * it began operating (market research, advertising, training, professional
 * fees, travel to secure suppliers/customers). The $5,000 immediate deduction
 * phases out dollar-for-dollar once total startup costs exceed $50,000, fully
 * disappearing at $55,000. Any remaining costs — the phased-out portion, or
 * everything beyond the $5,000 cap for smaller totals — are amortized ratably
 * over 180 months (15 years) starting the month the business begins operating.
 *
 * Only the first-year immediate deduction is modeled here, not the 15-year
 * amortization of any remainder.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';

const ID   = 'startup-costs';
const NAME = 'Startup Costs Deduction';

/** IRC §195 immediate-deduction cap and phaseout threshold/ceiling. */
const IMMEDIATE_DEDUCTION_CAP = 5_000;
const PHASEOUT_THRESHOLD      = 50_000;

export const startupCosts: Strategy = {
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
          'The startup costs deduction requires a business that incurred pre-opening ' +
          'expenses. No business entity is currently on file.',
        unlockCondition:
          'Open a business entity (sole proprietorship, single-member LLC, S-Corp, ' +
          'or partnership).',
        blockedBy: 'hasBusinessEntity',
      };
    }

    // ── Gate 2: business must be new (within its startup window) ───────────
    if (!s.isNewBusiness) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'The startup costs deduction only applies to costs incurred before a business ' +
          'began operating. Your business is not currently marked as new (less than ' +
          '24 months old).',
        unlockCondition:
          'This applies only in the year a business begins active operations — not ' +
          'available for an established business.',
        blockedBy: 'isNewBusiness',
      };
    }

    // ── Gate 3: startup costs recorded ──────────────────────────────────────
    if (s.startupCostsIncurred <= 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'Your business is on file as new, but no startup costs have been recorded yet — ' +
          'the immediate deduction is calculated directly from that figure.',
        unlockCondition:
          'Enter your total startup costs incurred before the business began operating ' +
          '(market research, advertising, training, professional fees, travel to secure ' +
          'suppliers or customers).',
        blockedBy: 'startupCostsIncurred',
      };
    }

    // ── ACTIVE ────────────────────────────────────────────────────────────────
    const phaseoutReduction   = Math.max(0, s.startupCostsIncurred - PHASEOUT_THRESHOLD);
    const immediateDeduction = Math.min(IMMEDIATE_DEDUCTION_CAP, Math.max(0, IMMEDIATE_DEDUCTION_CAP - phaseoutReduction));
    const estimatedAnnualValue = immediateDeduction;
    const remainder            = s.startupCostsIncurred - immediateDeduction;

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `Your $${s.startupCostsIncurred.toLocaleString()} in startup costs qualifies for ` +
        `an immediate deduction of $${estimatedAnnualValue.toLocaleString()} in the year your ` +
        `business began operating` +
        (immediateDeduction < IMMEDIATE_DEDUCTION_CAP
          ? ` (reduced from the $${IMMEDIATE_DEDUCTION_CAP.toLocaleString()} cap because total ` +
            `startup costs exceed the $${PHASEOUT_THRESHOLD.toLocaleString()} phaseout threshold).`
          : '.') +
        (remainder > 0
          ? ` The remaining $${Math.round(remainder).toLocaleString()} is amortized ratably ` +
            'over 180 months (15 years), starting the month the business began operating.'
          : ''),
    };
  },
};

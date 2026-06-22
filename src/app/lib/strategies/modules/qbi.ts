/**
 * Qualified Business Income Deduction — IRC §199A
 *
 * Allows owners of pass-through businesses (sole proprietorships, partnerships,
 * S-Corps, and 1099 self-employment) to deduct up to 20% of qualified business
 * income (QBI) from taxable income, reducing their effective tax rate on that
 * income significantly.
 *
 * Key limitations:
 *
 *   W-2 wage / capital limitation — for taxpayers above the phaseout threshold
 *   ($394,600 MFJ / $197,300 single for 2026), the deduction is limited to the
 *   greater of: (a) 50% of W-2 wages paid by the business, or (b) 25% of W-2
 *   wages + 2.5% of unadjusted basis of qualified property. Most small businesses
 *   with no employees will find their deduction limited or eliminated here.
 *
 *   Specified service trades or businesses (SSTBs) — health, law, consulting,
 *   financial services, athletics, and performing arts — phase out entirely once
 *   taxable income exceeds the phaseout range. Non-service businesses (real estate,
 *   manufacturing, retail) retain the deduction above the threshold if they pay
 *   sufficient W-2 wages.
 *
 *   The deduction is also capped at 20% of (taxable income − net capital gains),
 *   and does not reduce self-employment tax — only income tax.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getMarginalRate,
  getTaxableIncome,
  QBI_DEDUCTION_RATE,
  QBI_PHASEOUT_START,
} from '../taxConstants2026';

const ID   = 'qbi';
const NAME = 'Qualified Business Income Deduction (IRC §199A)';

/** Range over which SSTB deduction phases out completely (flat $50k single / $100k MFJ). */
const PHASEOUT_RANGE = { single: 50_000, mfj: 100_000 } as const;

export const qbi: Strategy = {
  id: ID,
  name: NAME,
  category: 'tax',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'tax',
    };

    const qualifiedIncome = s.businessRevenue + s.income1099;

    // ── LOCKED: no qualifying business or 1099 income ───────────────────────
    if (!s.hasBusinessEntity && s.income1099 === 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'The §199A deduction requires qualified business income from a pass-through ' +
          'entity or self-employment. No business entity or 1099 income is on file.',
        unlockCondition:
          'Open a business entity or generate 1099 / self-employment income.',
        blockedBy: 'hasBusinessEntity or income1099',
      };
    }

    const taxableIncome        = getTaxableIncome(s);
    const combinedMarginalRate = getMarginalRate(taxableIncome, s.filingStatus, s.state);
    const phaseoutStart        = QBI_PHASEOUT_START[s.filingStatus];
    const phaseoutEnd          = phaseoutStart + PHASEOUT_RANGE[s.filingStatus];
    const qbiDeduction         = qualifiedIncome * QBI_DEDUCTION_RATE;
    const estimatedAnnualValue = Math.round(qbiDeduction * combinedMarginalRate);

    // ── Warn about high-income limitation if above phaseout start ────────────
    if (taxableIncome >= phaseoutEnd) {
      return {
        ...base,
        state: 'VERIFY',
        estimatedAnnualValue: 0,
        reason:
          `Your taxable income ($${taxableIncome.toLocaleString()}) exceeds the §199A ` +
          `phaseout ceiling ($${phaseoutEnd.toLocaleString()} ${s.filingStatus === 'mfj' ? 'MFJ' : 'single'}). ` +
          `For specified service trades or businesses (consulting, law, financial services, ` +
          `health, etc.), the deduction is completely phased out at this income level. ` +
          `For non-service businesses, the deduction may still be available but is limited ` +
          `to the greater of 50% of W-2 wages paid or 25% of W-2 wages + 2.5% of ` +
          `qualified property basis — which eliminates it for most businesses with no employees.`,
        blockedBy:
          'taxableIncome: confirm with a tax advisor whether your business qualifies ' +
          'as a non-SSTB and pays sufficient W-2 wages to support the deduction above ' +
          'the phaseout threshold.',
      };
    }

    // Partial phaseout — warn but still show a reduced estimate
    const phaseoutNote = taxableIncome > phaseoutStart
      ? ` Note: your income ($${taxableIncome.toLocaleString()}) is within the §199A ` +
        `phaseout range ($${phaseoutStart.toLocaleString()}–$${phaseoutEnd.toLocaleString()}). ` +
        `The deduction phases out for specified service businesses (consulting, law, finance, ` +
        `health) in this range. The estimate above assumes full eligibility — confirm your ` +
        `business type with a tax advisor.`
      : '';

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `The §199A deduction allows you to deduct up to ${(QBI_DEDUCTION_RATE * 100).toFixed(0)}% ` +
        `of your qualified business income ($${Math.round(qualifiedIncome).toLocaleString()}) ` +
        `directly from taxable income — a $${Math.round(qbiDeduction).toLocaleString()} deduction ` +
        `that does not require spending any money. ` +
        `At your combined ${(combinedMarginalRate * 100).toFixed(1)}% marginal rate, that saves ` +
        `~$${estimatedAnnualValue.toLocaleString()}/year. ` +
        `The deduction does not reduce self-employment tax — only income tax. ` +
        `Ensure the income is reported on Schedule C, Schedule E, or via a K-1.` +
        phaseoutNote,
    };
  },
};

/**
 * Backdoor Roth IRA — IRC §§ 408(d)(6), 408A
 *
 * High-income taxpayers above the Roth IRA phaseout range cannot contribute
 * directly. The backdoor technique: contribute a non-deductible $7,000 to a
 * Traditional IRA (always allowed regardless of income), then immediately
 * convert it to Roth. With zero pre-tax basis in the Traditional IRA, the
 * conversion is tax-free. The result is a fully-funded Roth IRA that grows
 * and is withdrawn tax-free in retirement.
 *
 * Pro-rata rule (the main obstacle):
 *   If you hold any pre-tax Traditional IRA balances, the IRS aggregates ALL
 *   your IRA accounts when calculating the taxable portion of a conversion.
 *   A $7,000 after-tax contribution against a $100,000 pre-tax balance means
 *   ~93% of the converted amount is taxable — erasing most of the benefit.
 *   The fix: roll the pre-tax IRA balance into an employer 401(k) plan first.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getTaxableIncome,
  ROTH_PHASEOUT,
  CONTRIBUTION_LIMITS,
  GROWTH_ASSUMPTION_PCT,
  LTCG_RATE,
  DEFAULT_PROJECTION_YEARS,
} from '../taxConstants2026';

const ID   = 'backdoor-roth';
const NAME = 'Backdoor Roth IRA';

/** Existing Traditional IRA balance above this triggers the pro-rata VERIFY state. */
const PRO_RATA_THRESHOLD = 1_000;

export const backdoorRoth: Strategy = {
  id: ID,
  name: NAME,
  category: 'retirement',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'retirement',
    };

    const taxableIncome = getTaxableIncome(s);
    const phaseout      = ROTH_PHASEOUT[s.filingStatus];
    const limit         = CONTRIBUTION_LIMITS.ira;

    // ── Not applicable: income is below phaseout, direct Roth is available ──
    if (taxableIncome < phaseout.start) {
      return {
        ...base,
        state: 'NOT_APPLICABLE',
        estimatedAnnualValue: 0,
        reason:
          `Your taxable income ($${taxableIncome.toLocaleString()}) is below the ` +
          `${s.filingStatus === 'mfj' ? 'MFJ' : 'single'} Roth IRA phaseout ` +
          `($${phaseout.start.toLocaleString()}). You can contribute directly to a ` +
          `Roth IRA without the backdoor conversion — no workaround needed.`,
      };
    }

    // ── Pro-rata rule: existing pre-tax IRA balance is in the way ───────────
    if (s.traditionalIraBalance > PRO_RATA_THRESHOLD) {
      return {
        ...base,
        state: 'VERIFY',
        estimatedAnnualValue: 0,
        reason:
          'The IRS pro-rata rule applies. The IRS aggregates all of your Traditional, ' +
          'SEP, and SIMPLE IRA balances when computing the taxable fraction of a Roth ' +
          'conversion. With a significant pre-tax balance, converting $' +
          `${limit.toLocaleString()} will be mostly taxable, negating the strategy's benefit.`,
        blockedBy:
          `traditionalIraBalance: your $${s.traditionalIraBalance.toLocaleString()} ` +
          'pre-tax Traditional IRA balance triggers the pro-rata rule. ' +
          'To clear this obstacle, roll the pre-tax balance into your employer\'s ' +
          '401(k) or 403(b) plan (if the plan accepts incoming rollovers), ' +
          'or consider a full Roth conversion of the existing balance and pay the tax now.',
      };
    }

    // ── ACTIVE: income over phaseout, Traditional IRA is near-zero ──────────

    // Estimated value: after DEFAULT_PROJECTION_YEARS, Roth grows tax-free.
    // Vs. a taxable account, the annual drag is approximately LTCG_RATE on gains.
    // We model the contribution compounding, then apply the avoided capital-gains tax.
    const growthRate  = GROWTH_ASSUMPTION_PCT / 100;
    const futureValue = limit * Math.pow(1 + growthRate, DEFAULT_PROJECTION_YEARS);
    const totalGains  = futureValue - limit;
    // Tax saved versus a taxable account (capital-gains drag over the period)
    const taxDragSaved       = totalGains * LTCG_RATE;
    const estimatedAnnualValue = Math.round(taxDragSaved / DEFAULT_PROJECTION_YEARS);

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `Your taxable income ($${taxableIncome.toLocaleString()}) exceeds the ` +
        `${s.filingStatus === 'mfj' ? 'MFJ' : 'single'} Roth phaseout ceiling ` +
        `($${phaseout.end.toLocaleString()}), so a direct Roth contribution is not allowed. ` +
        `The backdoor: contribute $${limit.toLocaleString()} (non-deductible) to a ` +
        `Traditional IRA and convert immediately to Roth. Your near-zero Traditional IRA ` +
        `balance means the pro-rata rule does not apply, making the conversion fully ` +
        `tax-free. Projected capital-gains tax drag avoided over ${DEFAULT_PROJECTION_YEARS} ` +
        `years at ${GROWTH_ASSUMPTION_PCT}% growth: ~$${Math.round(taxDragSaved).toLocaleString()} ` +
        `(≈$${estimatedAnnualValue.toLocaleString()}/yr equivalent).`,
    };
  },
};

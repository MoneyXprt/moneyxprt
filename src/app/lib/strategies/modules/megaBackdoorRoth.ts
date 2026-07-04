/**
 * Mega Backdoor Roth — IRC §§ 402(g), 415; IRS Notice 2014-54
 *
 * A regular 401(k) limits employee deferrals to $24,500 in 2026. But the
 * §415 annual additions limit is $70,000 — leaving $45,500 of headroom.
 * If an employer's 401(k) plan permits:
 *   (a) after-tax (non-Roth) contributions beyond the normal deferral limit, AND
 *   (b) in-service distributions or in-plan Roth conversions,
 * then a participant can contribute up to ~$46,500 of after-tax dollars and
 * immediately convert them to Roth, effectively funding a giant Roth account
 * that grows and is withdrawn entirely tax-free.
 *
 * The critical catch: most 401(k) plans do NOT allow after-tax contributions
 * or in-service conversions. Plan documents must be reviewed, and this must be
 * confirmed with the plan administrator before relying on this strategy.
 *
 * IRS Notice 2014-54 clarified the tax treatment of these conversions,
 * making the technique unambiguously permissible where the plan allows it.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getTaxableIncome,
  CONTRIBUTION_LIMITS,
  GROWTH_ASSUMPTION_PCT,
  LTCG_RATE,
  DEFAULT_PROJECTION_YEARS,
} from '../taxConstants2026';

const ID   = 'mega-backdoor-roth';
const NAME = 'Mega Backdoor Roth (After-Tax 401k)';

/** Income threshold above which a VERIFY prompt is warranted. */
const HIGH_INCOME_THRESHOLD = 150_000;

export const megaBackdoorRoth: Strategy = {
  id: ID,
  name: NAME,
  category: 'retirement',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category' | 'valueType'> = {
      id: ID,
      name: NAME,
      category: 'retirement',
      valueType: 'projected',
    };

    const headroom = CONTRIBUTION_LIMITS.megaBackdoorRoth;

    // ── Plan explicitly does not allow it → LOCKED ───────────────────────────
    if (s.employer401kAllowsAfterTax === false) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'Your employer\'s 401(k) plan does not permit after-tax contributions or ' +
          'in-plan Roth conversions, which are both required for the mega backdoor Roth.',
        unlockCondition:
          'Requires an employer 401(k) plan that permits after-tax contributions and ' +
          'in-service conversions (or in-plan Roth conversions). This is a plan-document ' +
          'feature — advocate for the plan to be amended, or factor this into compensation ' +
          'negotiations with a new employer.',
        blockedBy: 'employer401kAllowsAfterTax',
      };
    }

    // ── Plan status unknown + high income → VERIFY ────────────────────────────
    if (s.employer401kAllowsAfterTax === undefined) {
      const taxableIncome = getTaxableIncome(s);
      if (taxableIncome >= HIGH_INCOME_THRESHOLD) {
        return {
          ...base,
          state: 'VERIFY',
          estimatedAnnualValue: 0,
          reason:
            `At your income level, the mega backdoor Roth can shelter an additional ` +
            `$${headroom.toLocaleString()}/year into a Roth account — but only if your ` +
            `employer's 401(k) plan document explicitly allows after-tax contributions ` +
            `and in-plan conversions (or in-service distributions). Most plans do not. ` +
            `This must be confirmed before contributing.`,
          blockedBy:
            'employer401kAllowsAfterTax: contact your HR or plan administrator and ask ' +
            'specifically: "Does our 401(k) plan allow after-tax contributions beyond the ' +
            'pre-tax limit, and can those be converted in-plan to Roth or distributed in-service?" ' +
            'Request a copy of the Summary Plan Description (SPD) to verify.',
        };
      }

      // Low income + unknown → not worth flagging as VERIFY
      return {
        ...base,
        state: 'NOT_APPLICABLE',
        estimatedAnnualValue: 0,
        reason:
          'The mega backdoor Roth offers the most value at higher income levels where ' +
          'sheltering additional after-tax dollars from future taxation is most impactful. ' +
          'If your income increases significantly, revisit this strategy.',
      };
    }

    // ── Plan confirmed → ACTIVE ──────────────────────────────────────────────
    // Value estimate: headroom amount invested in Roth vs. taxable account.
    // Avoided tax drag = LTCG on gains over the projection horizon, annualised.
    const growthRate     = GROWTH_ASSUMPTION_PCT / 100;
    const futureValue    = headroom * Math.pow(1 + growthRate, DEFAULT_PROJECTION_YEARS);
    const totalGains     = futureValue - headroom;
    const taxDragAvoided = totalGains * LTCG_RATE;
    const estimatedAnnualValue = Math.round(taxDragAvoided / DEFAULT_PROJECTION_YEARS);

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue,
      reason:
        `Your employer's 401(k) plan allows after-tax contributions and in-plan ` +
        `conversions, unlocking the mega backdoor Roth. You can contribute up to ` +
        `$${headroom.toLocaleString()}/year of after-tax dollars beyond the standard ` +
        `deferral limit and immediately convert to Roth — sheltering that growth ` +
        `completely from future taxation. ` +
        `Modelling $${headroom.toLocaleString()} compounding at ${GROWTH_ASSUMPTION_PCT}% ` +
        `over ${DEFAULT_PROJECTION_YEARS} years, the avoided capital-gains drag versus ` +
        `a taxable account is ~$${Math.round(taxDragAvoided).toLocaleString()} ` +
        `(≈$${estimatedAnnualValue.toLocaleString()}/yr equivalent). ` +
        `Coordinate with your payroll provider to set after-tax contribution elections ` +
        `and confirm the conversion timing with your plan recordkeeper.`,
    };
  },
};

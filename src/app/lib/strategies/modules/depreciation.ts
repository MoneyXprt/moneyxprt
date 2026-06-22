/**
 * Real Estate Depreciation + Cost Segregation — IRC §§ 167, 168
 *
 * Residential rental property is depreciated straight-line over 27.5 years
 * (IRC §168(c)). Only the building basis is depreciable — land is excluded.
 * A conservative assumption is that land represents ~15% of purchase price,
 * leaving 85% as depreciable building basis.
 *
 * Cost segregation (Rev. Proc. 87-56; IRC §168(e)):
 *   An engineering study reclassifies components of the building into
 *   shorter recovery periods (5-year or 15-year property), allowing
 *   accelerated or bonus depreciation (IRC §168(k)) in the year of purchase.
 *   On a $350k property, a cost-seg study typically front-loads
 *   $40,000–$60,000 of additional first-year deductions.
 *   Cost: $5,000–$15,000 for the study itself; pencils out at ~$300k+.
 *
 * Passive activity rules (IRC §469):
 *   Without Real Estate Professional Status, rental losses are "passive"
 *   and can only offset other passive income — NOT W-2 wages. The full
 *   depreciation deduction is suspended and carried forward until either
 *   the property is sold or the taxpayer qualifies as a REPS.
 *   With REPS (repsQualified === true), losses are non-passive and offset
 *   any income, including the high-earning spouse's W-2.
 */

import type { Strategy, FinancialSnapshot, StrategyResult } from '../types';
import {
  getMarginalRate,
  getTaxableIncome,
  DEPRECIATION_PERIOD_YEARS,
} from '../taxConstants2026';

const ID   = 'depreciation';
const NAME = 'Real Estate Depreciation + Cost Segregation (IRC §168)';

/** Fraction of purchase price treated as depreciable building basis (land excluded). */
const BUILDING_BASIS_FRACTION = 0.85;

/** Typical cost-segregation first-year deduction range, for narrative guidance. */
const COST_SEG_FIRST_YEAR_LOW  = 40_000;
const COST_SEG_FIRST_YEAR_HIGH = 60_000;

/** Minimum property value at which a cost-seg study is typically cost-effective. */
const COST_SEG_MIN_PROPERTY_VALUE = 300_000;

export const depreciation: Strategy = {
  id: ID,
  name: NAME,
  category: 'realEstate',

  evaluate(s: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category'> = {
      id: ID,
      name: NAME,
      category: 'realEstate',
    };

    // ── Gate: no real estate planned → LOCKED ───────────────────────────────
    if (!s.consideringRealEstate) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'Depreciation benefits require ownership of rental real estate. ' +
          'No property acquisition is currently planned.',
        unlockCondition: 'Plan a rental property acquisition and provide an estimated purchase price.',
      };
    }

    // ── No property value provided yet → VERIFY ─────────────────────────────
    if (!s.plannedPropertyValue || s.plannedPropertyValue <= 0) {
      return {
        ...base,
        state: 'VERIFY',
        estimatedAnnualValue: 0,
        reason:
          'You have indicated interest in real estate, but no planned property value has ' +
          'been provided. A purchase price is needed to estimate annual depreciation and ' +
          'the potential value of a cost segregation study.',
        blockedBy: 'plannedPropertyValue',
      };
    }

    // ── Compute straight-line annual depreciation ────────────────────────────
    const buildingBasis       = s.plannedPropertyValue * BUILDING_BASIS_FRACTION;
    const annualDepreciation  = buildingBasis / DEPRECIATION_PERIOD_YEARS;
    const taxableIncome       = getTaxableIncome(s);
    const combinedMarginalRate = getMarginalRate(taxableIncome, s.filingStatus, s.state);

    const costSegAdvised = s.plannedPropertyValue >= COST_SEG_MIN_PROPERTY_VALUE;

    // ── ACTIVE + REPS qualified: losses are non-passive, offset W-2 ─────────
    if (s.repsQualified === true) {
      const estimatedAnnualValue = Math.round(annualDepreciation * combinedMarginalRate);

      const costSegNote = costSegAdvised
        ? ` A cost segregation study on a property of this size typically front-loads ` +
          `$${COST_SEG_FIRST_YEAR_LOW.toLocaleString()}–` +
          `$${COST_SEG_FIRST_YEAR_HIGH.toLocaleString()} of additional first-year deductions ` +
          `via accelerated depreciation (IRC §168(k) bonus depreciation), worth ` +
          `~$${Math.round(COST_SEG_FIRST_YEAR_LOW * combinedMarginalRate).toLocaleString()}–` +
          `$${Math.round(COST_SEG_FIRST_YEAR_HIGH * combinedMarginalRate).toLocaleString()} ` +
          `in tax savings in year one. Study cost is typically $5,000–$15,000 and is ` +
          `deductible; at this property value it pencils out clearly.`
        : '';

      return {
        ...base,
        state: 'ACTIVE',
        estimatedAnnualValue,
        reason:
          `With Real Estate Professional Status confirmed, depreciation losses are ` +
          `non-passive and directly offset your W-2 income. ` +
          `On a $${s.plannedPropertyValue.toLocaleString()} property, the depreciable ` +
          `building basis is ~$${Math.round(buildingBasis).toLocaleString()} (${(BUILDING_BASIS_FRACTION * 100).toFixed(0)}% of purchase price, ` +
          `excluding land). Straight-line depreciation over ${DEPRECIATION_PERIOD_YEARS} years ` +
          `produces ~$${Math.round(annualDepreciation).toLocaleString()}/year in paper losses. ` +
          `At your combined ${(combinedMarginalRate * 100).toFixed(1)}% marginal rate ` +
          `(federal + ${s.state}), that is ~$${estimatedAnnualValue.toLocaleString()} in ` +
          `annual tax savings — without spending a dollar.` +
          costSegNote,
      };
    }

    // ── ACTIVE but passive: depreciation is suspended without REPS ──────────
    // Still ACTIVE because the property is planned and the loss is real —
    // it will be unlocked at sale or when REPS is achieved.
    const suspendedAnnualValue = Math.round(annualDepreciation * combinedMarginalRate);

    const costSegNote = costSegAdvised
      ? ` A cost segregation study could front-load ` +
        `$${COST_SEG_FIRST_YEAR_LOW.toLocaleString()}–` +
        `$${COST_SEG_FIRST_YEAR_HIGH.toLocaleString()} of accelerated depreciation in year one, ` +
        `but this deduction will also be suspended until REPS is achieved or the property is sold.`
      : '';

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue: 0,
      reason:
        `On a $${s.plannedPropertyValue.toLocaleString()} property, straight-line depreciation ` +
        `generates ~$${Math.round(annualDepreciation).toLocaleString()}/year in paper losses ` +
        `(building basis $${Math.round(buildingBasis).toLocaleString()} ÷ ${DEPRECIATION_PERIOD_YEARS} years). ` +
        `However, without Real Estate Professional Status, these losses are passive under ` +
        `IRC §469 and cannot offset your W-2 income. They accumulate as suspended losses ` +
        `and are released — at full value (~$${suspendedAnnualValue.toLocaleString()}/yr equivalent) — ` +
        `when the property is sold or when your household qualifies for REPS. ` +
        `Enable the REPS strategy to unlock this deduction against current-year W-2 income.` +
        costSegNote,
    };
  },
};

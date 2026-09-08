/**
 * Section 179 Heavy Vehicle Deduction — IRC § 179
 *
 * A business may immediately expense the cost of qualifying property placed
 * in service during the year, including vehicles rated over 6,000 lbs gross
 * vehicle weight rating (GVWR) — large SUVs and trucks. Unlike standard
 * passenger-vehicle depreciation limits, heavy vehicles are exempt from the
 * luxury-auto depreciation caps, but the §179 deduction for SUVs is itself
 * capped ($30,500 for 2026) and is only available for the business-use
 * percentage of the vehicle.
 *
 * This is one of the most heavily IRS-scrutinized vehicle deductions: the
 * business-use percentage must be genuine and documented with a contemporaneous
 * mileage log, must exceed 50%, and the vehicle must be placed in service the
 * same year the deduction is claimed.
 */

import type { Strategy, FinancialSnapshot, StrategyEvaluationContext, StrategyResult } from '../types';
import {
  getTaxableIncome,
  SECTION_179_VEHICLE_BUSINESS_USE_THRESHOLD_PCT,
} from '../taxConstants2026';
import { estimateDeductionTaxImpact } from '../taxImpact';
import { allocateSection179Deduction } from '../section179Shared';

const ID   = 'section-179-vehicle';
const NAME = 'Section 179 Heavy Vehicle Deduction';

/** Evaluates a heavy-vehicle deduction using the supplied, year-specific Section 179 constants. */
export const section179Vehicle: Strategy = {
  id: ID,
  name: NAME,
  category: 'tax',

  evaluate(s: FinancialSnapshot, context?: StrategyEvaluationContext): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category' | 'valueType'> = {
      id: ID,
      name: NAME,
      category: 'tax',
      valueType: 'cash',
    };
    const taxConstants = context?.section179TaxConstants;
    if (!taxConstants) {
      const unavailableReason = context?.section179TaxConstantsUnavailableReason === 'not-found'
        ? 'no confirmed Section 179 tax constants are available'
        : 'confirmed Section 179 tax constants could not be loaded';
      return {
        ...base,
        state: 'VERIFY',
        estimatedAnnualValue: 0,
        reason: `Unavailable — ${unavailableReason} for ${new Date().getFullYear()}.`,
        unlockCondition: 'Add a CPA-confirmed tax_constants_by_year record for this year.',
        blockedBy: 'section179TaxConstants',
      };
    }

    // ── Gate 1: business entity ─────────────────────────────────────────────
    if (!s.hasBusinessEntity) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'The §179 heavy vehicle deduction requires a business to place the vehicle in ' +
          'service for. No business entity is currently on file.',
        unlockCondition:
          'Open a business entity (sole proprietorship, single-member LLC, S-Corp, ' +
          'or partnership).',
        blockedBy: 'hasBusinessEntity',
      };
    }

    // ── Gate 2: heavy vehicle owned or being purchased ──────────────────────
    if (!s.hasHeavyVehicle) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'The §179 heavy vehicle deduction only applies to vehicles rated over 6,000 lbs ' +
          'gross vehicle weight rating (GVWR) — large SUVs and trucks. No qualifying vehicle ' +
          'is currently on file.',
        unlockCondition:
          'Confirm your vehicle\'s GVWR (usually on a sticker inside the driver-side door ' +
          'frame) exceeds 6,000 lbs.',
        blockedBy: 'hasHeavyVehicle',
      };
    }

    // ── Gate 3: business-use percentage must exceed 50% ──────────────────────
    if (s.vehicleBusinessUsePercent <= SECTION_179_VEHICLE_BUSINESS_USE_THRESHOLD_PCT) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'Business use must exceed 50% to qualify — this vehicle does not currently meet ' +
          'that threshold.',
        unlockCondition:
          'Increase documented business use above 50% (tracked via a contemporaneous ' +
          'mileage log), or reconsider whether this vehicle is genuinely a business asset.',
        blockedBy: 'vehicleBusinessUsePercent',
      };
    }

    // ── Gate 4: purchase price recorded ──────────────────────────────────────
    if (s.vehiclePurchasePrice <= 0) {
      return {
        ...base,
        state: 'LOCKED',
        estimatedAnnualValue: 0,
        reason:
          'Your vehicle qualifies by weight and business-use percentage, but its purchase ' +
          'price has not been recorded yet — the §179 deduction is calculated directly from ' +
          'that figure.',
        unlockCondition: 'Enter the vehicle\'s purchase price.',
        blockedBy: 'vehiclePurchasePrice',
      };
    }

    // ── ACTIVE ────────────────────────────────────────────────────────────────
    const deductibleAmount = allocateSection179Deduction({
      vehiclePurchasePrice: s.vehiclePurchasePrice,
      vehicleBusinessUsePercent: s.vehicleBusinessUsePercent,
      equipmentAssets: s.section179EquipmentAssets ?? [],
      taxConstants,
    }).vehicleDeduction;
    const taxImpact = estimateDeductionTaxImpact(deductibleAmount, s, getTaxableIncome(s));

    return {
      ...base,
      state: 'ACTIVE',
      estimatedAnnualValue: taxImpact.estimatedCashSavings,
      taxImpact,
      reason:
        `Your $${s.vehiclePurchasePrice.toLocaleString()} vehicle, used ` +
        `${s.vehicleBusinessUsePercent}% for business, qualifies for a §179 deduction of ` +
        `$${taxImpact.annualDeduction.toLocaleString()}` +
        (s.vehiclePurchasePrice * (s.vehicleBusinessUsePercent / 100) >= taxConstants.heavyVehicleCap
          ? ` (subject to the $${taxConstants.heavyVehicleCap.toLocaleString()} ${taxConstants.taxYear} SUV/heavy-vehicle limit and the shared annual §179 allowance).`
          : '.') +
        ` At your estimated marginal rate, that is about $${taxImpact.estimatedCashSavings.toLocaleString()} in current-year income-tax savings.`,
      cautionNote:
        'Requires genuine, documented business use exceeding 50% — a mileage log is ' +
        'mandatory. This is one of the most IRS-scrutinized vehicle deductions; buying a ' +
        'vehicle primarily for the tax benefit rather than real business need can trigger ' +
        'disallowance and penalties. Confirm with your CPA before purchasing.',
      evidenceRequirements: [
        'Purchase invoice and placed-in-service date',
        'Vehicle GVWR documentation',
        'Contemporaneous mileage log showing business use above 50%',
      ],
    };
  },
};

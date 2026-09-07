import type { FinancialSnapshot, Strategy, StrategyResult } from '../types';
import {
  TAX_YEAR,
  getTaxableIncome,
  SECTION_179_VEHICLE_BUSINESS_USE_THRESHOLD_PCT,
} from '../taxConstants2026';
import { estimateDeductionTaxImpact } from '../taxImpact';
import { allocateSection179Deduction } from '../section179Shared';

const ID = 'section-179-equipment';
const NAME = 'Section 179 Equipment & Machinery Deduction';

/** Evaluates qualifying non-vehicle equipment against the shared Section 179 allowance. */
export const section179Equipment: Strategy = {
  id: ID,
  name: NAME,
  category: 'tax',
  evaluate(snapshot: FinancialSnapshot): StrategyResult {
    const base: Pick<StrategyResult, 'id' | 'name' | 'category' | 'valueType'> = {
      id: ID, name: NAME, category: 'tax', valueType: 'cash',
    };
    if (!snapshot.hasBusinessEntity && snapshot.spouseBusinessRevenue <= 0) {
      return { ...base, state: 'LOCKED', estimatedAnnualValue: 0,
        reason: 'Section 179 equipment deductions require a business to place qualifying property in service.',
        unlockCondition: 'Add a business and its qualifying equipment.', blockedBy: 'hasBusinessEntity' };
    }
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: snapshot.hasHeavyVehicle && snapshot.vehicleBusinessUsePercent > SECTION_179_VEHICLE_BUSINESS_USE_THRESHOLD_PCT ? snapshot.vehiclePurchasePrice : 0,
      vehicleBusinessUsePercent: snapshot.hasHeavyVehicle && snapshot.vehicleBusinessUsePercent > SECTION_179_VEHICLE_BUSINESS_USE_THRESHOLD_PCT ? snapshot.vehicleBusinessUsePercent : 0,
      equipmentAssets: snapshot.section179EquipmentAssets ?? [],
    });
    if (allocation.qualifyingEquipmentCount === 0) {
      return { ...base, state: 'LOCKED', estimatedAnnualValue: 0,
        reason: `No equipment placed in service during ${TAX_YEAR} is on file.`,
        unlockCondition: 'Add each qualifying equipment or machinery purchase and its placed-in-service date.',
        blockedBy: 'section179EquipmentAssets' };
    }
    const taxImpact = estimateDeductionTaxImpact(
      allocation.equipmentDeduction,
      snapshot,
      getTaxableIncome(snapshot),
    );
    return { ...base, state: 'ACTIVE', estimatedAnnualValue: taxImpact.estimatedCashSavings, taxImpact,
      reason: `${allocation.qualifyingEquipmentCount} qualifying equipment item${allocation.qualifyingEquipmentCount === 1 ? '' : 's'} placed in service in ${TAX_YEAR} ` +
        `produce a combined §179 deduction of $${taxImpact.annualDeduction.toLocaleString()}. ` +
        `That is about $${taxImpact.estimatedCashSavings.toLocaleString()} in current-year income-tax savings.`,
      cautionNote: 'Section 179 requires genuine business use and adequate records. Confirm eligibility, placed-in-service timing, and the aggregate deduction with your CPA.',
      evidenceRequirements: ['Purchase invoice for each asset', 'Placed-in-service date', 'Business-use records for each asset'] };
  },
};

import { describe, expect, it } from 'vitest';
import { allocateSection179Deduction } from './section179Shared';
import type { Section179TaxConstants } from './types';

const TAX_CONSTANTS: Section179TaxConstants = {
  taxYear: 2026,
  heavyVehicleCap: 32_000,
  maxDeduction: 2_560_000,
  phaseOutThreshold: 4_090_000,
  completePhaseOut: 6_650_000,
};

describe('allocateSection179Deduction', () => {
  it('caps vehicle and equipment together rather than granting separate annual caps', () => {
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 100_000,
      vehicleBusinessUsePercent: 100,
      equipmentAssets: [{
        description: 'Commercial embroidery machine',
        purchasePrice: TAX_CONSTANTS.maxDeduction,
        businessUsePercent: 100,
        placedInServiceDate: '2026-09-07',
      }],
      taxConstants: TAX_CONSTANTS,
    });

    expect(allocation.requestedDeduction).toBeGreaterThan(TAX_CONSTANTS.maxDeduction);
    expect(allocation.allowedDeduction).toBe(TAX_CONSTANTS.maxDeduction);
    expect(allocation.vehicleDeduction + allocation.equipmentDeduction).toBeCloseTo(TAX_CONSTANTS.maxDeduction);
    expect(allocation.vehicleDeduction).toBeLessThan(TAX_CONSTANTS.heavyVehicleCap);
    expect(allocation.equipmentDeduction).toBeLessThan(TAX_CONSTANTS.maxDeduction);
  });

  it('reduces the shared allowance once qualifying property exceeds the phase-out threshold', () => {
    const phaseOutExcess = 50_000;
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 0,
      vehicleBusinessUsePercent: 0,
      equipmentAssets: [{
        description: 'Production equipment',
        purchasePrice: TAX_CONSTANTS.phaseOutThreshold + phaseOutExcess,
        businessUsePercent: 100,
        placedInServiceDate: '2026-09-07',
      }],
      taxConstants: TAX_CONSTANTS,
    });

    expect(allocation.phaseOutReduction).toBe(phaseOutExcess);
    expect(allocation.allowedDeduction).toBe(TAX_CONSTANTS.maxDeduction - phaseOutExcess);
  });

  it('eliminates the shared allowance at the complete phase-out point', () => {
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 0, vehicleBusinessUsePercent: 0,
      equipmentAssets: [{ description: 'Large production equipment', purchasePrice: TAX_CONSTANTS.completePhaseOut, businessUsePercent: 100, placedInServiceDate: `${TAX_CONSTANTS.taxYear}-01-01` }],
      taxConstants: TAX_CONSTANTS,
    });

    expect(allocation.allowedDeduction).toBe(0);
  });

  it('includes property placed in the current tax year', () => {
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 0, vehicleBusinessUsePercent: 0,
      equipmentAssets: [{ description: 'Current-year machine', purchasePrice: 11_000, businessUsePercent: 100, placedInServiceDate: `${TAX_CONSTANTS.taxYear}-01-01` }],
      taxConstants: TAX_CONSTANTS,
    });

    expect(allocation.qualifyingEquipmentCount).toBe(1);
    expect(allocation.equipmentDeduction).toBe(11_000);
  });

  it('excludes property placed in a prior tax year', () => {
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 0, vehicleBusinessUsePercent: 0,
      equipmentAssets: [{ description: 'Prior-year machine', purchasePrice: 11_000, businessUsePercent: 100, placedInServiceDate: `${TAX_CONSTANTS.taxYear - 1}-12-31` }],
      taxConstants: TAX_CONSTANTS,
    });

    expect(allocation.qualifyingEquipmentCount).toBe(0);
    expect(allocation.equipmentDeduction).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  SECTION_179_HEAVY_VEHICLE_CAP_2026,
  SECTION_179_OVERALL_CAP_2026,
  SECTION_179_PHASE_OUT_THRESHOLD_2026,
  TAX_YEAR,
} from './taxConstants2026';
import { allocateSection179Deduction } from './section179Shared';

describe('allocateSection179Deduction', () => {
  it('caps vehicle and equipment together rather than granting separate annual caps', () => {
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 100_000,
      vehicleBusinessUsePercent: 100,
      equipmentAssets: [{
        description: 'Commercial embroidery machine',
        purchasePrice: 1_500_000,
        businessUsePercent: 100,
        placedInServiceDate: '2026-09-07',
      }],
    });

    expect(allocation.requestedDeduction).toBeGreaterThan(SECTION_179_OVERALL_CAP_2026);
    expect(allocation.allowedDeduction).toBe(SECTION_179_OVERALL_CAP_2026);
    expect(allocation.vehicleDeduction + allocation.equipmentDeduction).toBeCloseTo(SECTION_179_OVERALL_CAP_2026);
    expect(allocation.vehicleDeduction).toBeLessThan(SECTION_179_HEAVY_VEHICLE_CAP_2026);
    expect(allocation.equipmentDeduction).toBeLessThan(SECTION_179_OVERALL_CAP_2026);
  });

  it('reduces the shared allowance once qualifying property exceeds the phase-out threshold', () => {
    const phaseOutExcess = 50_000;
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 0,
      vehicleBusinessUsePercent: 0,
      equipmentAssets: [{
        description: 'Production equipment',
        purchasePrice: SECTION_179_PHASE_OUT_THRESHOLD_2026 + phaseOutExcess,
        businessUsePercent: 100,
        placedInServiceDate: '2026-09-07',
      }],
    });

    expect(allocation.phaseOutReduction).toBe(phaseOutExcess);
    expect(allocation.allowedDeduction).toBe(SECTION_179_OVERALL_CAP_2026 - phaseOutExcess);
  });

  it('includes property placed in the current tax year', () => {
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 0, vehicleBusinessUsePercent: 0,
      equipmentAssets: [{ description: 'Current-year machine', purchasePrice: 11_000, businessUsePercent: 100, placedInServiceDate: `${TAX_YEAR}-01-01` }],
    });

    expect(allocation.qualifyingEquipmentCount).toBe(1);
    expect(allocation.equipmentDeduction).toBe(11_000);
  });

  it('excludes property placed in a prior tax year', () => {
    const allocation = allocateSection179Deduction({
      vehiclePurchasePrice: 0, vehicleBusinessUsePercent: 0,
      equipmentAssets: [{ description: 'Prior-year machine', purchasePrice: 11_000, businessUsePercent: 100, placedInServiceDate: `${TAX_YEAR - 1}-12-31` }],
    });

    expect(allocation.qualifyingEquipmentCount).toBe(0);
    expect(allocation.equipmentDeduction).toBe(0);
  });
});

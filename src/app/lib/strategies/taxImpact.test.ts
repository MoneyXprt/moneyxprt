import { describe, expect, it } from 'vitest';
import { estimateDeductionTaxImpact } from './taxImpact';

const HEAVY_VEHICLE_DEDUCTION = 32_000;

describe('estimateDeductionTaxImpact', () => {
  it('keeps the deduction distinct from estimated cash tax savings', () => {
    const impact = estimateDeductionTaxImpact(
      HEAVY_VEHICLE_DEDUCTION,
      { filingStatus: 'mfj', state: 'CA' },
      378_191,
    );

    expect(impact.annualDeduction).toBe(HEAVY_VEHICLE_DEDUCTION);
    expect(impact.estimatedCashSavings).toBe(10_656);
    expect(impact.estimatedCashSavings).toBeLessThan(impact.annualDeduction);
  });

  it('does not return a negative deduction or tax benefit', () => {
    const impact = estimateDeductionTaxImpact(-100, { filingStatus: 'single', state: 'TX' }, 0);
    expect(impact.annualDeduction).toBe(0);
    expect(impact.estimatedCashSavings).toBe(0);
  });
});

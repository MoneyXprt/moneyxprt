import { describe, expect, it } from 'vitest';
import { buildTaxSituationSnapshotFields, clearHomeOfficeAnswers, clearStartupCostAnswers, clearVehicleAnswers, type TaxSituationFormState } from './taxSituationFlow';

const base: TaxSituationFormState = {
  filingStatus: 'mfj', state: 'CA', currentTaxPaid: '10000', hasBusinessEntity: true,
  businessRevenue: '50000', primaryBusinessNetProfit: '25000', primaryBusinessType: 'smllc', primaryHoursPerWeekInBusiness: '10',
  hasDedicatedHomeOffice: true, homeOfficeSquareFootage: '200', isNewBusiness: true, startupCostsIncurred: '5000',
  hasHeavyVehicle: true, vehiclePurchasePrice: '70000', vehicleBusinessUsePercent: '80', spouseHasSeparateBusiness: false,
  spouseBusinessType: '', hasHsaAvailable: true, employer401kAllowsAfterTax: undefined, hasCpa: true, cpaProactive: true,
};

describe('Tax Situation Audit snapshot fields', () => {
  it('clears each dependent answer set when its gate is declined', () => {
    expect(clearHomeOfficeAnswers()).toEqual({ hasDedicatedHomeOffice: false, homeOfficeSquareFootage: '' });
    expect(clearStartupCostAnswers()).toEqual({ isNewBusiness: false, startupCostsIncurred: '' });
    expect(clearVehicleAnswers()).toEqual({ hasHeavyVehicle: false, vehiclePurchasePrice: '', vehicleBusinessUsePercent: '' });
  });

  it('defensively excludes stale dependent values from the final snapshot', () => {
    const snapshot = buildTaxSituationSnapshotFields({ ...base, hasDedicatedHomeOffice: false, isNewBusiness: false, hasHeavyVehicle: false }, { spouseWorks: false });
    expect(snapshot).toMatchObject({ homeOfficeSquareFootage: 0, startupCostsIncurred: 0, vehiclePurchasePrice: 0, vehicleBusinessUsePercent: 0 });
  });

  it('preserves the existing Head of Household normalization for downstream strategies', () => {
    expect(buildTaxSituationSnapshotFields({ ...base, filingStatus: 'hoh' }, { spouseWorks: false }).filingStatus).toBe('single');
  });
});

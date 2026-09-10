import { describe, expect, it } from 'vitest';
import { buildBalanceSheetSnapshotFields, calculateHomeEquity, clearRentalAnswers, isMortgageAtOrAboveHomeValue, type BalanceSheetFormState } from './balanceSheetFlow';

const base: BalanceSheetFormState = {
  primaryResidenceValue: '500000', mortgageBalance: '300000', currentlyOwnsRental: true,
  rentalPropertyValue: '400000', rentalMortgageBalance: '200000', retirementBalance: '250000',
  traditionalIraBalance: '10000', taxableBrokerageBalance: '80000', businessEquityValue: '60000',
};

describe('Balance Sheet Audit snapshot fields', () => {
  it('zeros negative home equity and identifies an underwater mortgage', () => {
    expect(calculateHomeEquity('400000', '500000')).toBe(0);
    expect(isMortgageAtOrAboveHomeValue('400000', '500000')).toBe(true);
  });

  it('clears rental answers and defensively excludes them when ownership is off', () => {
    expect(clearRentalAnswers()).toEqual({ currentlyOwnsRental: false, rentalPropertyValue: '', rentalMortgageBalance: '' });
    expect(buildBalanceSheetSnapshotFields({ ...base, currentlyOwnsRental: false }, { hasBusinessEntity: false, spouseWorks: false, spouseHasSeparateBusiness: false })).toMatchObject({ rentalPropertyValue: 0, rentalMortgageBalance: 0 });
  });

  it('includes business equity when only the spouse has a separate business', () => {
    expect(buildBalanceSheetSnapshotFields(base, { hasBusinessEntity: false, spouseWorks: true, spouseHasSeparateBusiness: true }).businessEquityValue).toBe(60000);
  });
});

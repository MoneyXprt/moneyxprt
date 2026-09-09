import { describe, expect, it } from 'vitest';
import { buildIncomeSnapshotFields, clampDeferredBonus } from './incomeFlow';

const base = {
  w2Income: '200000', bonusIncome: '30000', bonusDefers: true, bonusDeferred: '5000', bonusFrequency: 'annual' as const, bonusPlanAmount: '30000', bonusPaymentMonth: '3', income1099: '', carAllowanceAnnual: '', otherIncomeAnnual: '', monthlyRentalIncome: '', monthlyDividendIncome: '', spouseWorks: false, spouseIncomeType: '' as const, spouseW2Income: '', spouseBusinessRevenue: '', spouseBusinessNetProfit: '',
};

describe('Income Audit snapshot fields', () => {
  it('clamps deferred bonus to the gross bonus while retaining an empty draft input', () => {
    expect(clampDeferredBonus('40000', '30000')).toBe('30000');
    expect(clampDeferredBonus('', '30000')).toBe('');
  });

  it('derives bonus cash and excludes spouse values when spouse income is off', () => {
    expect(buildIncomeSnapshotFields(base)).toMatchObject({ bonusIncome: 30000, bonusDeferred: 5000, bonusTakenAsCash: 25000, spouseW2Income: 0, spouseBusinessRevenue: 0, spouseBusinessNetProfit: 0 });
  });
});

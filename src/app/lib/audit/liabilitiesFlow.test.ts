import { describe, expect, it } from 'vitest';
import { buildLiabilitiesSnapshotFields, createEmptyLiabilitiesForm, getLiabilitySteps, LIABILITY_MAX_STEPS } from './liabilitiesFlow';

describe('Liabilities question flow', () => {
  it('uses a fixed maximum across selected and tracker branches', () => {
    const empty = createEmptyLiabilitiesForm();
    const selected = { ...empty, hasCarLoan: true, hasOtherDebt: true };

    expect(LIABILITY_MAX_STEPS).toBe(26);
    expect(getLiabilitySteps(selected, {}, new Set())).toEqual(['debt-types', 'car_loan-balance', 'car_loan-rate', 'car_loan-payment', 'car_loan-original-balance', 'other-label', 'other-balance', 'other-rate', 'other-payment', 'other-original-balance']);
    expect(getLiabilitySteps(selected, { car_loan: { name: 'Car Loan', balance: 20_980, rate: 6, payment: 980 } }, new Set(['other']))).toEqual(['debt-types', 'car_loan-tracked', 'other-paid-off']);
  });

  it('preserves the existing snapshot mapping and omits deselected debt values', () => {
    const form = { ...createEmptyLiabilitiesForm(), hasCarLoan: true, carLoanBalance: '20,980', carLoanRate: '6', carLoanPayment: '980', hasOtherDebt: true, otherDebtLabel: 'Pool Loan', otherDebtBalance: '41,844', otherDebtRate: '8.99', otherDebtPayment: '500', businessLoanBalance: '100' };
    const fields = buildLiabilitiesSnapshotFields(form);

    expect(fields.carLoanBalance).toBe(20_980);
    expect(fields.carLoanRate).toBe(6);
    expect(fields.otherDebtLabel).toBe('Pool Loan');
    expect(fields.debts).toEqual(expect.arrayContaining([{ type: 'car', balance: 20_980, rate: 0.06, payment: 980 }, { type: 'Pool Loan', balance: 41_844, rate: expect.closeTo(0.0899), payment: 500 }]));
    expect(fields.businessLoanBalance).toBe(0);
  });
});

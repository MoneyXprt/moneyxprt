import { describe, expect, it } from 'vitest';
import {
  computeAnnualBonusNetEstimate,
  computeAnnualBonusNetEstimateSource,
  computeAnnualDeployableTotal,
  computeGrossAnnualIncome,
  computeMonthlyDeployable,
  computeMonthlyTakeHome,
  estimateNetBonus,
} from './deployableCapital';
import type { FinancialSnapshot } from './strategies/types';

const now = new Date('2026-06-15T12:00:00.000Z');

describe('bonus net estimate', () => {
  it('estimates monthly bonus income net of withholding for twelve months', () => {
    const plan = { frequency: 'monthly' as const, planAmount: 1_000, paymentMonth: null };
    expect(computeAnnualBonusNetEstimate(plan, [], now)).toBeCloseTo(estimateNetBonus(1_000) * 12);
    expect(computeAnnualBonusNetEstimateSource(plan, [], now)).toBe('estimated');
  });

  it('uses the actual net amount for an annual payment in the relevant period', () => {
    const plan = { frequency: 'annual' as const, planAmount: 20_000, paymentMonth: 5 };
    const payments = [{ amount: 20_000, netAmount: 12_345, datePaid: new Date('2026-05-20T00:00:00.000Z') }];
    expect(computeAnnualBonusNetEstimate(plan, payments, now)).toBe(12_345);
    expect(computeAnnualBonusNetEstimateSource(plan, payments, now)).toBe('actual');
  });

  it('does not assume cash from a passed unlogged bonus period', () => {
    const plan = { frequency: 'annual' as const, planAmount: 20_000, paymentMonth: 5 };
    expect(computeAnnualBonusNetEstimate(plan, [], now)).toBe(0);
    expect(computeAnnualBonusNetEstimateSource(plan, [], now)).toBe('none');
  });

  it('estimates an upcoming annual bonus rather than treating it as actual cash', () => {
    const plan = { frequency: 'annual' as const, planAmount: 20_000, paymentMonth: 12 };
    expect(computeAnnualBonusNetEstimate(plan, [], now)).toBeCloseTo(estimateNetBonus(20_000));
    expect(computeAnnualBonusNetEstimateSource(plan, [], now)).toBe('estimated');
  });
});

const recurringSnapshot = {
  w2Income: 120_000, income1099: 12_000, carAllowanceAnnual: 0, otherIncomeAnnual: 0,
  spouseW2Income: 60_000, spouseBusinessNetProfit: 0, monthlyRentalIncome: 1_000, monthlyDividendIncome: 500,
  bonusTakenAsCash: 10_000, currentTaxPaid: 38_000,
  essentialMonthlySpend: 5_000, discretionaryMonthlySpend: 1_000,
  carLoanPayment: 200, studentLoanPayment: 100, personalLoanPayment: 0, creditCardPayment: 0, businessLoanPayment: 0, otherDebtPayment: 0,
  extraDebtPayments: 100, childSupportMonthly: 0, alimonyMonthly: 0,
} as FinancialSnapshot;

describe('recurring deployable capital', () => {
  it('keeps irregular bonus income out of recurring take-home and grossly reports it separately', () => {
    expect(computeGrossAnnualIncome(recurringSnapshot)).toBe(220_000);
    expect(computeMonthlyTakeHome(recurringSnapshot)).toBeCloseTo(172_000 / 12);
  });

  it('subtracts spending and every reported debt/payment obligation', () => {
    expect(computeMonthlyDeployable(recurringSnapshot)).toBeCloseTo((172_000 / 12) - 5_000 - 1_000 - 200 - 100 - 100);
  });

  it('adds an annual bonus only to the annual deployable figure', () => {
    const plan = { frequency: 'annual' as const, planAmount: 10_000, paymentMonth: 12 };
    expect(computeAnnualDeployableTotal(recurringSnapshot, plan, [], now)).toBeCloseTo(
      computeMonthlyDeployable(recurringSnapshot) * 12 + estimateNetBonus(10_000),
    );
  });
});

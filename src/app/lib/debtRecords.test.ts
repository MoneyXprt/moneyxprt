import { describe, expect, it } from 'vitest';
import { DEBT_CORRECTION_MIN_REASON_LENGTH, validateDebtCorrection } from './debtRecords';

const activeCorrection = { originalBalance: 61_000, currentBalance: 20_980, interestRate: 6, minimumPayment: 980, isActive: true };

describe('validateDebtCorrection', () => {
  it('accepts an active correction with a sufficient audit reason', () => {
    expect(validateDebtCorrection(activeCorrection, 'seed data error — no real payment recorded')).toBeNull();
  });

  it('requires an audit reason at the configured minimum length', () => {
    expect(validateDebtCorrection(activeCorrection, 'x'.repeat(DEBT_CORRECTION_MIN_REASON_LENGTH - 1))).toContain('Reason must be');
  });

  it('requires zero balance for a paid-off debt and a positive balance for an active debt', () => {
    expect(validateDebtCorrection({ ...activeCorrection, currentBalance: 1, isActive: false }, 'valid correction reason')).toContain('paid-off');
    expect(validateDebtCorrection({ ...activeCorrection, currentBalance: 0, isActive: true }, 'valid correction reason')).toContain('active debt');
  });

  it('accepts corrections to only the original balance or to both balances', () => {
    expect(validateDebtCorrection({ ...activeCorrection, originalBalance: 62_000 }, 'corrected original loan amount')).toBeNull();
    expect(validateDebtCorrection({ ...activeCorrection, originalBalance: 65_000, currentBalance: 22_000 }, 'corrected loan balances together')).toBeNull();
  });

  it('rejects an original balance that is lower than the current balance', () => {
    expect(validateDebtCorrection({ ...activeCorrection, originalBalance: 20_000 }, 'incorrect original balance')).toContain('at least the current balance');
  });

  it('accepts corrections to only the interest rate or minimum payment', () => {
    expect(validateDebtCorrection({ ...activeCorrection, interestRate: 5.25 }, 'corrected interest rate from statement')).toBeNull();
    expect(validateDebtCorrection({ ...activeCorrection, minimumPayment: 1_025 }, 'corrected payment from loan statement')).toBeNull();
  });

  it('accepts a balance and interest-rate correction together', () => {
    expect(validateDebtCorrection({ ...activeCorrection, currentBalance: 21_500, interestRate: 5.75 }, 'corrected balance and interest rate together')).toBeNull();
  });

  it('rejects negative interest rates and minimum payments', () => {
    expect(validateDebtCorrection({ ...activeCorrection, interestRate: -0.01 }, 'negative interest rate is invalid')).toContain('interest rate');
    expect(validateDebtCorrection({ ...activeCorrection, minimumPayment: -1 }, 'negative minimum payment is invalid')).toContain('minimum payment');
  });
});

import { describe, expect, it } from 'vitest';
import { DEBT_CORRECTION_MIN_REASON_LENGTH, validateDebtCorrection } from './debtRecords';

const activeCorrection = { currentBalance: 20_980, isActive: true };

describe('validateDebtCorrection', () => {
  it('accepts an active correction with a sufficient audit reason', () => {
    expect(validateDebtCorrection(activeCorrection, 'seed data error — no real payment recorded')).toBeNull();
  });

  it('requires an audit reason at the configured minimum length', () => {
    expect(validateDebtCorrection(activeCorrection, 'x'.repeat(DEBT_CORRECTION_MIN_REASON_LENGTH - 1))).toContain('Reason must be');
  });

  it('requires zero balance for a paid-off debt and a positive balance for an active debt', () => {
    expect(validateDebtCorrection({ currentBalance: 1, isActive: false }, 'valid correction reason')).toContain('paid-off');
    expect(validateDebtCorrection({ currentBalance: 0, isActive: true }, 'valid correction reason')).toContain('active debt');
  });
});

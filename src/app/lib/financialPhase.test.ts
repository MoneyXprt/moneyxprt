import { describe, expect, it } from 'vitest';
import { computeFinancialPhase, MINI_EMERGENCY_FUND_TARGET } from './financialPhase';

describe('computeFinancialPhase', () => {
  it('prioritizes the mini emergency fund before debt', () => {
    expect(computeFinancialPhase({ emergencyFund: MINI_EMERGENCY_FUND_TARGET - 1, monthlySpend: 4_000 }, true)).toBe('funding_mini_ef');
  });

  it('prioritizes active debt after the mini emergency fund is funded', () => {
    expect(computeFinancialPhase({ emergencyFund: MINI_EMERGENCY_FUND_TARGET, monthlySpend: 4_000 }, true)).toBe('paying_debt');
  });

  it('builds a full six-month fund before unlocking assets when debt-free', () => {
    expect(computeFinancialPhase({ emergencyFund: 12_000, monthlySpend: 4_000 }, false)).toBe('building_full_ef');
    expect(computeFinancialPhase({ emergencyFund: 24_000, monthlySpend: 4_000 }, false)).toBe('assets_unlocked');
  });
});

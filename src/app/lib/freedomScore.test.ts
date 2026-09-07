import { describe, expect, it } from 'vitest';
import { calculateFreedomScore, type FreedomScoreInputs } from './freedomScore';

const blank: FreedomScoreInputs = {
  hasFreedomProfile: false, hasFreedomNumber: false, hasSnapshot: false,
  hasAssetPreferences: false, hasConstraints: false,
  activeStrategies: 0, implementedStrategies: 0,
  monthlyRentalIncome: 0, monthlyDividendIncome: 0,
  currentPassiveMonthly: 0, freedomNumberMonthly: 0,
  completedActions: 0, thisWeekActionsTotal: 0, thisWeekActionsCompleted: 0,
};

describe('calculateFreedomScore', () => {
  it('returns zero before any planning work is complete', () => {
    expect(calculateFreedomScore(blank)).toEqual({ plan: 0, strategies: 0, assets: 0, execution: 0, total: 0 });
  });

  it('awards the complete plan score and caps over-completed strategies', () => {
    const result = calculateFreedomScore({
      ...blank,
      hasFreedomProfile: true, hasFreedomNumber: true, hasSnapshot: true, hasAssetPreferences: true, hasConstraints: true,
      activeStrategies: 3, implementedStrategies: 5,
    });
    expect(result).toMatchObject({ plan: 20, strategies: 30, assets: 0, execution: 0, total: 50 });
  });

  it('rewards the first asset, passive-income thresholds, and execution milestones', () => {
    const result = calculateFreedomScore({
      ...blank,
      monthlyDividendIncome: 501, currentPassiveMonthly: 5_000, freedomNumberMonthly: 10_000,
      completedActions: 5, thisWeekActionsTotal: 2, thisWeekActionsCompleted: 2,
    });
    expect(result).toMatchObject({ assets: 30, execution: 20, total: 50 });
  });

  it('does not award a weekly execution point for an incomplete week', () => {
    const result = calculateFreedomScore({ ...blank, thisWeekActionsTotal: 3, thisWeekActionsCompleted: 2 });
    expect(result.execution).toBe(0);
  });
});

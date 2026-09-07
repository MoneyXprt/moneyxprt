import { describe, expect, it } from 'vitest';
import { goalProgressPercent, normalizeGoalBucket } from './goalBuckets';

describe('goal buckets', () => {
  it('normalizes a valid bucket and clamps displayed progress', () => {
    expect(normalizeGoalBucket({
      name: '  Emergency fund ', category: 'emergency', targetAmount: 50_000, currentAmount: 12_345.678,
    })).toMatchObject({ name: 'Emergency fund', currentAmount: 12_345.68, targetDate: null });
    expect(goalProgressPercent({ targetAmount: 100, currentAmount: 120 })).toBe(100);
  });

  it('rejects invalid amounts and dates', () => {
    expect(() => normalizeGoalBucket({
      name: 'Travel', category: 'travel', targetAmount: 0, currentAmount: 0,
    })).toThrow('greater than zero');
    expect(() => normalizeGoalBucket({
      name: 'Travel', category: 'travel', targetAmount: 100, currentAmount: 0, targetDate: '2026-02-30',
    })).toThrow('YYYY-MM-DD');
  });
});

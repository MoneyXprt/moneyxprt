import { describe, expect, it } from 'vitest';
import { normalizeFinancialObservation } from './financialObservations';

describe('normalizeFinancialObservation', () => {
  it('preserves a valid observation with currency precision', () => {
    expect(normalizeFinancialObservation({
      metric: 'net_worth', value: 1234.567, observedOn: '2026-09-06', source: 'manual', note: '  Monthly check-in  ',
    })).toEqual({
      metric: 'net_worth', value: 1234.57, observedOn: '2026-09-06', source: 'manual', note: 'Monthly check-in',
    });
  });

  it('rejects malformed dates and non-finite values', () => {
    expect(() => normalizeFinancialObservation({
      metric: 'cash', value: Number.NaN, observedOn: '2026-09-06', source: 'manual',
    })).toThrow('reasonable finite number');
    expect(() => normalizeFinancialObservation({
      metric: 'cash', value: 10, observedOn: '2026-02-31', source: 'manual',
    })).toThrow('YYYY-MM-DD');
  });
});

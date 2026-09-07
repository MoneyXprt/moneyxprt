import { describe, expect, it } from 'vitest';
import { computeRepsRelevance, type AssetRoadmapRow } from './planGenerator';

function row(year: number, assetType: string, action: string): AssetRoadmapRow {
  return {
    year, calendarYear: 2026 + year, assetType, action,
    capitalDeployed: 0, estimatedMonthlyIncomeAdded: 0,
    cumulativeMonthlyIncome: 0, remainingGap: 0,
  };
}

describe('computeRepsRelevance', () => {
  it('is relevant immediately for an existing rental owner', () => {
    expect(computeRepsRelevance(true, [])).toEqual({ relevant: true, rentalAcquisitionRow: undefined });
  });

  it('is relevant when the first rental acquisition is within two roadmap years', () => {
    const acquisition = row(2, 'long_term_rental', 'Acquire long-term rental');
    expect(computeRepsRelevance(false, [acquisition])).toEqual({ relevant: true, rentalAcquisitionRow: acquisition });
  });

  it('does not surface REPS for later, unrelated, or non-acquisition rows', () => {
    expect(computeRepsRelevance(false, [
      row(3, 'long_term_rental', 'Acquire long-term rental'),
      row(1, 'index_funds', 'Invest in index funds'),
      row(1, 'short_term_rental', 'Operate short-term rental'),
    ])).toMatchObject({ relevant: false, rentalAcquisitionRow: expect.objectContaining({ year: 3 }) });
  });
});

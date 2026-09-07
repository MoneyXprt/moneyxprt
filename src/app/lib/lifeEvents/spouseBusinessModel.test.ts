import { describe, expect, it } from 'vitest';
import { evaluateSpouseBusinessStrategies } from '../calculations/spouseBusiness';
import {
  buildSpouseBusinessInputs,
  draftFromSnapshot,
  getTopSpouseBusinessStrategies,
} from './spouseBusinessModel';
import type { SpouseBusinessSnapshotContext } from './spouseBusinessTypes';

const context: SpouseBusinessSnapshotContext = {
  snapshotId: 'snapshot-id',
  annualRevenue: 12_000,
  filingStatus: 'mfj',
  state: 'CA',
  householdIncome: 410_000,
  dependentsUnder18: 2,
  ownsHome: true,
  homeOfficeSquareFootage: 100,
  vehiclePurchaseAmount: 0,
  vehicleBusinessUsePercent: 0,
};

describe('spouse business flow model', () => {
  it('prefills monthly revenue from the annual snapshot value', () => {
    expect(draftFromSnapshot(context)).toMatchObject({
      hasSales: true,
      monthlyRevenue: 1_000,
    });
  });

  it('uses the household snapshot to build calculation inputs', () => {
    const input = buildSpouseBusinessInputs(
      {
        hasSales: true,
        monthlyRevenue: 1_000,
        expenseCategories: ['home_office'],
        familyInvolvement: 'kids_help',
      },
      context,
    );
    expect(input).toMatchObject({
      monthlyRevenue: 1_000,
      dependentsUnder18: 2,
      ownsHome: true,
    });
    expect(input.marginalRate).toBeCloseTo(0.413);
  });

  it('returns no more than the four highest-ranked strategies', () => {
    const strategies = evaluateSpouseBusinessStrategies(
      buildSpouseBusinessInputs(
        {
          hasSales: true,
          monthlyRevenue: 6_000,
          expenseCategories: ['home_office', 'vehicle'],
          familyInvolvement: 'kids_help',
        },
        context,
      ),
      { now: new Date(2026, 8, 1) },
    );
    const top = getTopSpouseBusinessStrategies(strategies);
    expect(top).toHaveLength(4);
    expect(top.map((strategy) => strategy.annualSavings)).toEqual(
      [...top].map((strategy) => strategy.annualSavings).sort((a, b) => b - a),
    );
  });
});

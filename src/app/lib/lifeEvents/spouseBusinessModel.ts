import { getMarginalRate } from '../strategies/taxConstants2026';
import type {
  SpouseBusinessInputs,
  SpouseBusinessStrategy,
} from '../calculations/spouseBusiness';
import type {
  SpouseBusinessDraft,
  SpouseBusinessSnapshotContext,
} from './spouseBusinessTypes';

export const SPOUSE_BUSINESS_STEP_COUNT = 4;
export const SPOUSE_BUSINESS_RESULT_COUNT = 4;
export const MONTHS_PER_YEAR = 12;

/** Build smart defaults from the latest saved annual business revenue. */
export function draftFromSnapshot(
  context: SpouseBusinessSnapshotContext,
): SpouseBusinessDraft {
  const monthlyRevenue = context.annualRevenue / MONTHS_PER_YEAR;
  return {
    hasSales: context.annualRevenue > 0,
    monthlyRevenue: context.annualRevenue > 0 ? monthlyRevenue : null,
    expenseCategories: [],
    familyInvolvement: null,
  };
}

/** Convert saved context and flow answers into pure calculation inputs. */
export function buildSpouseBusinessInputs(
  draft: SpouseBusinessDraft,
  context: SpouseBusinessSnapshotContext,
): SpouseBusinessInputs {
  return {
    monthlyRevenue: draft.hasSales ? draft.monthlyRevenue : 0,
    expenseCategories: draft.expenseCategories,
    familyInvolvement: draft.familyInvolvement,
    marginalRate: getMarginalRate(
      context.householdIncome,
      context.filingStatus,
      context.state,
    ),
    filingStatus: context.filingStatus,
    dependentsUnder18: context.dependentsUnder18,
    ownsHome: context.ownsHome,
    homeOfficeSquareFootage: context.homeOfficeSquareFootage,
    vehiclePurchaseAmount: context.vehiclePurchaseAmount,
    vehicleBusinessUsePercent: context.vehicleBusinessUsePercent,
  };
}

/** Select the four highest-value recommendations for the results screen. */
export function getTopSpouseBusinessStrategies(
  strategies: readonly SpouseBusinessStrategy[],
): SpouseBusinessStrategy[] {
  return strategies.slice(0, SPOUSE_BUSINESS_RESULT_COUNT);
}

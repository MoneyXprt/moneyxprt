import type {
  FamilyInvolvement,
  SpouseBusinessExpenseCategory,
} from '../calculations/spouseBusiness';

/** Answers captured by the four-screen spouse-business flow. */
export interface SpouseBusinessDraft {
  hasSales: boolean | null;
  monthlyRevenue: number | null;
  expenseCategories: SpouseBusinessExpenseCategory[];
  familyInvolvement: FamilyInvolvement | null;
}

/** Snapshot context used to prefill the flow and calculate its results. */
export interface SpouseBusinessSnapshotContext {
  snapshotId: string;
  annualRevenue: number;
  filingStatus: 'single' | 'mfj';
  state: string;
  householdIncome: number;
  dependentsUnder18: number;
  ownsHome: boolean;
  homeOfficeSquareFootage: number;
  vehiclePurchaseAmount: number;
  vehicleBusinessUsePercent: number;
}

/** Payload accepted by the add-to-plan endpoint. */
export interface AddSpouseBusinessPlanRequest {
  monthlyRevenue: number;
  strategyIds: string[];
  expenseCategories: SpouseBusinessExpenseCategory[];
  familyInvolvement: FamilyInvolvement;
}

/** Empty answers used when no prior snapshot values exist. */
export const EMPTY_SPOUSE_BUSINESS_DRAFT: SpouseBusinessDraft = {
  hasSales: null,
  monthlyRevenue: null,
  expenseCategories: [],
  familyInvolvement: null,
};

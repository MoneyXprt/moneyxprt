export type StrategyState = 'ACTIVE' | 'VERIFY' | 'LOCKED' | 'NOT_APPLICABLE';

export interface FinancialSnapshot {
  w2Income: number;
  bonusIncome: number;
  income1099: number;
  spouseWorks: boolean;
  filingStatus: 'single' | 'mfj';
  state: string;
  dependentsUnder18: number;
  hasBusinessEntity: boolean;
  businessRevenue: number;
  currentTaxPaid: number;
  monthlySpend: number;
  emergencyFund: number;
  retirementBalance: number;
  homeEquity: number;
  traditionalIraBalance: number;
  hasHsaAvailable: boolean;
  consideringRealEstate: boolean;
  debts: { type: string; balance: number; rate: number; payment: number }[];
  // Real-estate enrichment fields (optional — populated once the user
  // has a specific acquisition in mind or has qualified for REPS)
  plannedPropertyValue?: number;
  repsQualified?: boolean;
}

export interface StrategyResult {
  id: string;
  name: string;
  category: 'tax' | 'retirement' | 'realEstate' | 'businessStructure' | 'debt' | 'investment' | 'family';
  state: StrategyState;
  estimatedAnnualValue: number;
  reason: string;           // why this state
  unlockCondition?: string; // what would unlock it, if LOCKED
  blockedBy?: string;       // the specific input standing in the way, if any
}

export interface Strategy {
  id: string;
  name: string;
  category: StrategyResult['category'];
  evaluate: (s: FinancialSnapshot) => StrategyResult;
}

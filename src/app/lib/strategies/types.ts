export type StrategyState = 'ACTIVE' | 'VERIFY' | 'LOCKED' | 'NOT_APPLICABLE';

export interface FinancialSnapshot {
  w2Income: number;
  bonusIncome: number;       // gross total bonus / profit share
  bonusDeferred: number;     // portion deferred (not taxable this year)
  bonusTakenAsCash: number;  // portion taken as cash (taxable this year) = bonusIncome − bonusDeferred
  income1099: number;
  spouseWorks: boolean;
  filingStatus: 'single' | 'mfj';
  state: string;
  dependentsUnder18: number;
  hasBusinessEntity: boolean;
  businessRevenue: number;
  primaryBusinessNetProfit: number;
  primaryBusinessType: string;
  primaryHoursPerWeekInBusiness: number;
  spouseW2Income: number;
  spouseBusinessRevenue: number;
  spouseBusinessNetProfit: number;
  spouseBusinessType: string;
  spouseHoursPerWeekInBusiness: number;
  currentTaxPaid: number;
  monthlySpend: number;
  emergencyFund: number;
  retirementBalance: number;
  homeEquity: number;
  traditionalIraBalance: number;
  monthlyRentalIncome: number;
  monthlyDividendIncome: number;
  hasHsaAvailable: boolean;
  consideringRealEstate: boolean;
  debts: { type: string; balance: number; rate: number; payment: number }[];
  // Real-estate enrichment fields (optional)
  plannedPropertyValue?: number;
  repsQualified?: boolean;
  // Retirement plan enrichment (optional)
  employer401kAllowsAfterTax?: boolean;
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

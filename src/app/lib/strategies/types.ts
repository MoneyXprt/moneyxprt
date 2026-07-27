export type StrategyState = 'ACTIVE' | 'VERIFY' | 'LOCKED' | 'NOT_APPLICABLE';

export interface FinancialSnapshot {
  // ── Income ──────────────────────────────────────────────────────────────────
  w2Income: number;
  bonusIncome: number;       // gross total bonus / profit share
  bonusDeferred: number;     // portion deferred (not taxable this year)
  bonusTakenAsCash: number;  // bonusIncome − bonusDeferred
  income1099: number;
  carAllowanceAnnual: number;
  otherIncomeAnnual: number;
  spouseWorks: boolean;
  // ── Filing & location ────────────────────────────────────────────────────────
  filingStatus: 'single' | 'mfj'; // 'hoh' maps to 'single' at form submit
  state: string;
  dependentsUnder18: number;
  dependentAges: string;          // comma-separated, e.g. "12, 15"
  // ── Primary business ────────────────────────────────────────────────────────
  hasBusinessEntity: boolean;
  businessRevenue: number;
  primaryBusinessNetProfit: number;
  primaryBusinessType: string;
  primaryHoursPerWeekInBusiness: number;
  hasDedicatedHomeOffice: boolean;
  homeOfficeSquareFootage: number;
  // ── Spouse income ────────────────────────────────────────────────────────────
  spouseW2Income: number;
  spouseBusinessRevenue: number;
  spouseBusinessNetProfit: number;
  spouseBusinessType: string;
  spouseHoursPerWeekInBusiness: number;  // total hours across all employment/business
  // ── Tax ────────────────────────────────────────────────────────────────────
  currentTaxPaid: number;
  hasHsaAvailable: boolean;
  hasCpa: boolean;
  cpaProactive: boolean;
  // ── Balance sheet ───────────────────────────────────────────────────────────
  primaryResidenceValue: number;
  mortgageBalance: number;
  homeEquity: number;              // derived: max(0, primaryResidenceValue − mortgageBalance)
  currentlyOwnsRental: boolean;   // true = owns rental property today (not just planning)
  rentalPropertyValue: number;
  rentalMortgageBalance: number;
  retirementBalance: number;
  traditionalIraBalance: number;
  taxableBrokerageBalance: number;
  businessEquityValue: number;
  // ── Monthly flows ──────────────────────────────────────────────────────────
  monthlyRentalIncome: number;
  monthlyDividendIncome: number;
  essentialMonthlySpend: number;
  discretionaryMonthlySpend: number;
  monthlySpend: number;           // essentialMonthlySpend + discretionaryMonthlySpend
  emergencyFund: number;
  extraDebtPayments: number;      // typical monthly amount paid above minimums, across all debts
  childSupportMonthly: number;
  alimonyMonthly: number;
  // ── Liabilities ──────────────────────────────────────────────────────────────
  carLoanBalance: number;
  carLoanRate: number;
  carLoanPayment: number;
  studentLoanBalance: number;
  studentLoanRate: number;
  studentLoanPayment: number;
  personalLoanBalance: number;
  personalLoanRate: number;
  personalLoanPayment: number;
  creditCardBalance: number;
  creditCardRate: number;
  creditCardPayment: number;
  businessLoanBalance: number;
  businessLoanRate: number;
  businessLoanPayment: number;
  otherDebtLabel: string;
  otherDebtBalance: number;
  otherDebtRate: number;
  otherDebtPayment: number;
  debts: { type: string; balance: number; rate: number; payment: number }[];
  // ── Retirement plan ────────────────────────────────────────────────────────
  employer401kAllowsAfterTax?: boolean;
  // ── Phase 2 / future planning (preserved for plan generator, not used by Phase 1 strategy engine) ──
  consideringRealEstate: boolean;
  plannedPropertyValue?: number;
  repsQualified?: boolean;
  excludedStrategyIds?: string[];       // strategy ids the user chose not to commit to in Phase 2
  targetAcquisitionTimeframe?: string;  // 'This year' | 'Next year' | '2-3 years' | 'Just exploring'
}

export interface StrategyResult {
  id: string;
  name: string;
  category: 'tax' | 'retirement' | 'realEstate' | 'businessStructure' | 'debt' | 'investment' | 'family';
  state: StrategyState;
  estimatedAnnualValue: number;
  valueType: 'cash' | 'projected';
  reason: string;
  unlockCondition?: string;
  blockedBy?: string;
}

export interface Strategy {
  id: string;
  name: string;
  category: StrategyResult['category'];
  evaluate: (s: FinancialSnapshot) => StrategyResult;
}

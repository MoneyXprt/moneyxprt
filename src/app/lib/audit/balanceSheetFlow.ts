import type { FinancialSnapshot } from '@/app/lib/strategies/types';

/** Local Balance Sheet answers held until the full Audit saves a snapshot. */
export interface BalanceSheetFormState {
  primaryResidenceValue: string; mortgageBalance: string;
  currentlyOwnsRental: boolean; rentalPropertyValue: string; rentalMortgageBalance: string;
  retirementBalance: string; traditionalIraBalance: string;
  taxableBrokerageBalance: string; businessEquityValue: string;
}

/** Existing Tax Situation answers used to determine household business ownership. */
export interface EffectiveBusinessContext {
  hasBusinessEntity: boolean; spouseWorks: boolean; spouseHasSeparateBusiness: boolean;
}

type BalanceSheetSnapshotFields = Pick<FinancialSnapshot,
  'primaryResidenceValue' | 'mortgageBalance' | 'homeEquity' | 'currentlyOwnsRental' |
  'rentalPropertyValue' | 'rentalMortgageBalance' | 'retirementBalance' |
  'traditionalIraBalance' | 'taxableBrokerageBalance' | 'businessEquityValue'>;

/** Converts a local money answer to the zero-safe snapshot representation. */
function parseBalanceNumber(value: string): number {
  return value === '' ? 0 : Number.parseFloat(value.replace(/,/g, '')) || 0;
}

/** Determines whether either partner has the business entity required by household strategy questions. */
export function hasEffectiveBusinessEntity(context: EffectiveBusinessContext): boolean {
  return context.hasBusinessEntity || (context.spouseWorks && context.spouseHasSeparateBusiness);
}

/** Calculates home equity without allowing a negative balance to enter the snapshot. */
export function calculateHomeEquity(residenceValue: string, mortgageBalance: string): number {
  return Math.max(0, parseBalanceNumber(residenceValue) - parseBalanceNumber(mortgageBalance));
}

/** Identifies an underwater or fully mortgaged home for the explanatory UI note. */
export function isMortgageAtOrAboveHomeValue(residenceValue: string, mortgageBalance: string): boolean {
  const mortgage = parseBalanceNumber(mortgageBalance);
  return mortgage > 0 && mortgage >= parseBalanceNumber(residenceValue);
}

/** Clears rental answers when the household does not currently own a rental. */
export function clearRentalAnswers(): Pick<BalanceSheetFormState, 'currentlyOwnsRental' | 'rentalPropertyValue' | 'rentalMortgageBalance'> {
  return { currentlyOwnsRental: false, rentalPropertyValue: '', rentalMortgageBalance: '' };
}

/** Builds Balance Sheet fields while preserving the Audit ownership and rental gates. */
export function buildBalanceSheetSnapshotFields(form: BalanceSheetFormState, context: EffectiveBusinessContext): BalanceSheetSnapshotFields {
  return {
    primaryResidenceValue: parseBalanceNumber(form.primaryResidenceValue),
    mortgageBalance: parseBalanceNumber(form.mortgageBalance),
    homeEquity: calculateHomeEquity(form.primaryResidenceValue, form.mortgageBalance),
    currentlyOwnsRental: form.currentlyOwnsRental,
    rentalPropertyValue: form.currentlyOwnsRental ? parseBalanceNumber(form.rentalPropertyValue) : 0,
    rentalMortgageBalance: form.currentlyOwnsRental ? parseBalanceNumber(form.rentalMortgageBalance) : 0,
    retirementBalance: parseBalanceNumber(form.retirementBalance),
    traditionalIraBalance: parseBalanceNumber(form.traditionalIraBalance),
    taxableBrokerageBalance: parseBalanceNumber(form.taxableBrokerageBalance),
    businessEquityValue: hasEffectiveBusinessEntity(context) ? parseBalanceNumber(form.businessEquityValue) : 0,
  };
}

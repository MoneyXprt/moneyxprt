import type { FinancialSnapshot } from '@/app/lib/strategies/types';

export type BonusFrequency = 'monthly' | 'quarterly' | 'annual' | '';
export type SpouseIncomeType = 'w2' | 'self_employment' | 'both' | '';

/** Income answers held locally until the full Audit snapshot is submitted. */
export interface IncomeFormState {
  w2Income: string;
  bonusIncome: string;
  bonusDefers: boolean;
  bonusDeferred: string;
  bonusFrequency: BonusFrequency;
  bonusPlanAmount: string;
  bonusPaymentMonth: string;
  income1099: string;
  carAllowanceAnnual: string;
  otherIncomeAnnual: string;
  monthlyRentalIncome: string;
  monthlyDividendIncome: string;
  spouseWorks: boolean;
  spouseIncomeType: SpouseIncomeType;
  spouseW2Income: string;
  spouseBusinessRevenue: string;
  spouseBusinessNetProfit: string;
}

/** Converts a currency-form field to the numeric value persisted in a snapshot. */
export function parseIncomeAmount(value: string): number {
  return value === '' ? 0 : Number.parseFloat(value.replace(/,/g, '')) || 0;
}

/** Caps a deferred bonus so it can never exceed the gross bonus amount. */
export function clampDeferredBonus(deferred: string, grossBonus: string): string {
  if (deferred === '') return '';
  return String(Math.min(parseIncomeAmount(deferred), parseIncomeAmount(grossBonus)));
}

/** Produces the Income-owned portion of the final FinancialSnapshot payload. */
export function buildIncomeSnapshotFields(form: IncomeFormState): Pick<FinancialSnapshot,
  'w2Income' | 'bonusIncome' | 'bonusDeferred' | 'bonusTakenAsCash' | 'income1099' |
  'carAllowanceAnnual' | 'otherIncomeAnnual' | 'monthlyRentalIncome' | 'monthlyDividendIncome' |
  'spouseWorks' | 'spouseW2Income' | 'spouseBusinessRevenue' | 'spouseBusinessNetProfit'> {
  const bonusIncome = parseIncomeAmount(form.bonusIncome);
  const bonusDeferred = form.bonusDefers
    ? Math.min(parseIncomeAmount(form.bonusDeferred), bonusIncome)
    : 0;
  const spouseHasW2 = form.spouseWorks && (form.spouseIncomeType === 'w2' || form.spouseIncomeType === 'both');
  const spouseHasBusiness = form.spouseWorks && (form.spouseIncomeType === 'self_employment' || form.spouseIncomeType === 'both');

  return {
    w2Income: parseIncomeAmount(form.w2Income),
    bonusIncome,
    bonusDeferred,
    bonusTakenAsCash: bonusIncome - bonusDeferred,
    income1099: parseIncomeAmount(form.income1099),
    carAllowanceAnnual: parseIncomeAmount(form.carAllowanceAnnual),
    otherIncomeAnnual: parseIncomeAmount(form.otherIncomeAnnual),
    monthlyRentalIncome: parseIncomeAmount(form.monthlyRentalIncome),
    monthlyDividendIncome: parseIncomeAmount(form.monthlyDividendIncome),
    spouseWorks: form.spouseWorks,
    spouseW2Income: spouseHasW2 ? parseIncomeAmount(form.spouseW2Income) : 0,
    spouseBusinessRevenue: spouseHasBusiness ? parseIncomeAmount(form.spouseBusinessRevenue) : 0,
    spouseBusinessNetProfit: spouseHasBusiness ? parseIncomeAmount(form.spouseBusinessNetProfit) : 0,
  };
}

import type { FinancialSnapshot } from '@/app/lib/strategies/types';

/** Local Tax Situation answers held until the full Audit saves a snapshot. */
export interface TaxSituationFormState {
  filingStatus: 'single' | 'mfj' | 'hoh'; state: string; currentTaxPaid: string;
  hasBusinessEntity: boolean; businessRevenue: string; primaryBusinessNetProfit: string;
  primaryBusinessType: string; primaryHoursPerWeekInBusiness: string;
  hasDedicatedHomeOffice: boolean; homeOfficeSquareFootage: string;
  isNewBusiness: boolean; startupCostsIncurred: string;
  hasHeavyVehicle: boolean; vehiclePurchasePrice: string; vehicleBusinessUsePercent: string;
  spouseHasSeparateBusiness: boolean; spouseBusinessType: string;
  hasHsaAvailable: boolean; employer401kAllowsAfterTax: boolean | undefined;
  hasCpa: boolean | undefined; cpaProactive: boolean | undefined;
}

/** Context from Income that determines whether a spouse entity is effective. */
export interface TaxSituationContext { spouseWorks: boolean; }

type TaxSnapshotFields = Pick<FinancialSnapshot,
  'filingStatus' | 'state' | 'hasBusinessEntity' | 'businessRevenue' | 'primaryBusinessNetProfit' |
  'primaryBusinessType' | 'primaryHoursPerWeekInBusiness' | 'hasDedicatedHomeOffice' |
  'homeOfficeSquareFootage' | 'isNewBusiness' | 'startupCostsIncurred' | 'hasHeavyVehicle' |
  'vehiclePurchasePrice' | 'vehicleBusinessUsePercent' | 'spouseBusinessType' | 'currentTaxPaid' |
  'hasHsaAvailable' | 'hasCpa' | 'cpaProactive' | 'employer401kAllowsAfterTax'>;

/** Converts a local numeric answer to the zero-safe snapshot representation. */
function parseTaxNumber(value: string): number {
  return value === '' ? 0 : Number.parseFloat(value.replace(/,/g, '')) || 0;
}

/** Clears home-office answers when the dedicated-space gate is declined. */
export function clearHomeOfficeAnswers(): Pick<TaxSituationFormState, 'hasDedicatedHomeOffice' | 'homeOfficeSquareFootage'> {
  return { hasDedicatedHomeOffice: false, homeOfficeSquareFootage: '' };
}

/** Clears startup-cost answers when the new-business gate is declined. */
export function clearStartupCostAnswers(): Pick<TaxSituationFormState, 'isNewBusiness' | 'startupCostsIncurred'> {
  return { isNewBusiness: false, startupCostsIncurred: '' };
}

/** Clears vehicle answers when the qualifying-heavy-vehicle gate is declined. */
export function clearVehicleAnswers(): Pick<TaxSituationFormState, 'hasHeavyVehicle' | 'vehiclePurchasePrice' | 'vehicleBusinessUsePercent'> {
  return { hasHeavyVehicle: false, vehiclePurchasePrice: '', vehicleBusinessUsePercent: '' };
}

/** Builds Tax Situation fields while preserving the Audit entity-gating rules. */
export function buildTaxSituationSnapshotFields(form: TaxSituationFormState, context: TaxSituationContext): TaxSnapshotFields {
  const effectiveHasBusinessEntity = form.hasBusinessEntity || (context.spouseWorks && form.spouseHasSeparateBusiness);
  return {
    filingStatus: form.filingStatus === 'hoh' ? 'single' : form.filingStatus,
    state: form.state,
    hasBusinessEntity: effectiveHasBusinessEntity,
    businessRevenue: form.hasBusinessEntity ? parseTaxNumber(form.businessRevenue) : 0,
    primaryBusinessNetProfit: form.hasBusinessEntity ? parseTaxNumber(form.primaryBusinessNetProfit) : 0,
    primaryBusinessType: form.hasBusinessEntity ? form.primaryBusinessType : '',
    primaryHoursPerWeekInBusiness: form.hasBusinessEntity ? parseTaxNumber(form.primaryHoursPerWeekInBusiness) : 0,
    hasDedicatedHomeOffice: effectiveHasBusinessEntity ? form.hasDedicatedHomeOffice : false,
    homeOfficeSquareFootage: effectiveHasBusinessEntity && form.hasDedicatedHomeOffice ? parseTaxNumber(form.homeOfficeSquareFootage) : 0,
    isNewBusiness: effectiveHasBusinessEntity ? form.isNewBusiness : false,
    startupCostsIncurred: effectiveHasBusinessEntity && form.isNewBusiness ? parseTaxNumber(form.startupCostsIncurred) : 0,
    hasHeavyVehicle: effectiveHasBusinessEntity ? form.hasHeavyVehicle : false,
    vehiclePurchasePrice: effectiveHasBusinessEntity && form.hasHeavyVehicle ? parseTaxNumber(form.vehiclePurchasePrice) : 0,
    vehicleBusinessUsePercent: effectiveHasBusinessEntity && form.hasHeavyVehicle ? parseTaxNumber(form.vehicleBusinessUsePercent) : 0,
    spouseBusinessType: context.spouseWorks && form.spouseHasSeparateBusiness ? form.spouseBusinessType : '',
    currentTaxPaid: parseTaxNumber(form.currentTaxPaid),
    hasHsaAvailable: form.hasHsaAvailable,
    hasCpa: form.hasCpa ?? false,
    cpaProactive: form.cpaProactive ?? false,
    employer401kAllowsAfterTax: form.employer401kAllowsAfterTax,
  };
}

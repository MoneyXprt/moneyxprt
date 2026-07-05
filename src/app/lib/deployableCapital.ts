import type { FinancialSnapshot } from './strategies/types';

/** Monthly take-home = (gross annual income − taxes) / 12 */
export function computeMonthlyTakeHome(s: FinancialSnapshot): number {
  const grossAnnual =
    s.w2Income +
    s.bonusTakenAsCash +
    s.income1099 +
    s.carAllowanceAnnual +
    s.otherIncomeAnnual +
    s.spouseW2Income +
    s.spouseBusinessNetProfit +
    (s.monthlyRentalIncome * 12) +
    (s.monthlyDividendIncome * 12);
  return Math.max(0, (grossAnnual - s.currentTaxPaid) / 12);
}

/**
 * Monthly capital deployable toward assets: take-home pay minus essential/discretionary
 * spend minus minimum debt payments.
 *
 * Only carLoanPayment exists as a real monthly-payment field on FinancialSnapshot today —
 * student/personal/credit-card/business debts only carry balance + rate, with no payment
 * captured (the audit form hardcodes payment: 0 for those in the `debts[]` array). This is
 * a partial fix pending a proper debt module that captures/derives payments for all debt
 * types; until then, this understates true minimum debt service for anyone carrying
 * non-car debt.
 */
export function computeMonthlyDeployable(s: FinancialSnapshot): number {
  const monthlyTakeHome        = computeMonthlyTakeHome(s);
  const monthlyMinDebtPayments = s.carLoanPayment;
  return Math.max(0, monthlyTakeHome - s.essentialMonthlySpend - s.discretionaryMonthlySpend - monthlyMinDebtPayments);
}

import {
  getFederalMarginalRate,
  getStateMarginalRate,
} from './taxConstants2026';
import type { FinancialSnapshot, TaxImpactEstimate } from './types';

/**
 * Estimate current-year income-tax savings from a deductible amount.
 * This is a marginal-rate estimate, not a tax return calculation.
 */
export function estimateDeductionTaxImpact(
  deduction: number,
  snapshot: Pick<FinancialSnapshot, 'filingStatus' | 'state'>,
  taxableIncome: number,
): TaxImpactEstimate {
  const annualDeduction = Math.max(0, Math.round(deduction));
  const federalMarginalRate = getFederalMarginalRate(taxableIncome, snapshot.filingStatus);
  const stateMarginalRate = getStateMarginalRate(taxableIncome, snapshot.state);
  const estimatedFederalSavings = Math.round(annualDeduction * federalMarginalRate);
  const estimatedStateSavings = Math.round(annualDeduction * stateMarginalRate);

  return {
    annualDeduction,
    federalMarginalRate,
    stateMarginalRate,
    estimatedFederalSavings,
    estimatedStateSavings,
    estimatedCashSavings: estimatedFederalSavings + estimatedStateSavings,
  };
}

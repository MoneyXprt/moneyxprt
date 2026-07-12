import type { FinancialSnapshot } from './strategies/types';

export type FinancialPhase = 'funding_mini_ef' | 'paying_debt' | 'building_full_ef' | 'assets_unlocked';

/** Only these two fields are ever read — narrowed so callers don't need a full snapshot. */
export type FinancialPhaseSnapshotInput = Pick<FinancialSnapshot, 'emergencyFund' | 'monthlySpend'>;

/** Mini emergency fund target — a fixed cash buffer before anything else matters. */
export const MINI_EMERGENCY_FUND_TARGET = 5_000;

/**
 * Determines the user's current financial phase from their latest snapshot and whether
 * they have any active debt on file:
 *
 *   liquid savings < $5,000                                    → funding_mini_ef
 *   liquid savings >= $5,000 and any active debt                → paying_debt
 *   no active debt and liquid savings < full EF target          → building_full_ef
 *   otherwise (no active debt, full EF target met)               → assets_unlocked
 *
 * "Liquid savings" is snapshot.emergencyFund. "Full emergency fund target" is
 * monthlySpend × 6, matching the existing convention used elsewhere in this codebase
 * (see the emergency-fund color thresholds on the Audit summary page and the
 * emergency-fund action in actionGenerator.ts, both of which treat 6 months of spend
 * as the fully-funded target).
 */
export function computeFinancialPhase(snapshot: FinancialPhaseSnapshotInput, hasActiveDebts: boolean): FinancialPhase {
  const liquidSavings  = snapshot.emergencyFund;
  const fullEfTarget   = snapshot.monthlySpend * 6;

  if (liquidSavings < MINI_EMERGENCY_FUND_TARGET) return 'funding_mini_ef';
  if (hasActiveDebts) return 'paying_debt';
  if (liquidSavings < fullEfTarget) return 'building_full_ef';
  return 'assets_unlocked';
}

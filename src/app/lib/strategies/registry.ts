import type { Strategy, FinancialSnapshot, StrategyResult } from './types';
import { augustaRule }  from './modules/augustaRule';
import { hireKids }     from './modules/hireKids';
import { backdoorRoth } from './modules/backdoorRoth';

/**
 * All registered strategy modules.
 * Add new strategies here — evaluateAll picks them up automatically.
 */
export const registry: Strategy[] = [
  augustaRule,
  hireKids,
  backdoorRoth,
];

/**
 * Run every registered strategy against a financial snapshot.
 * Returns results sorted: ACTIVE → VERIFY → LOCKED → NOT_APPLICABLE,
 * then by estimatedAnnualValue descending within each group.
 */
export function evaluateAll(snapshot: FinancialSnapshot): StrategyResult[] {
  const STATE_ORDER: Record<string, number> = {
    ACTIVE:         0,
    VERIFY:         1,
    LOCKED:         2,
    NOT_APPLICABLE: 3,
  };

  return registry
    .map(strategy => strategy.evaluate(snapshot))
    .sort((a, b) => {
      const stateA = STATE_ORDER[a.state] ?? 9;
      const stateB = STATE_ORDER[b.state] ?? 9;
      if (stateA !== stateB) return stateA - stateB;
      return b.estimatedAnnualValue - a.estimatedAnnualValue;
    });
}

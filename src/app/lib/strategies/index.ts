/**
 * Strategy engine barrel export.
 *
 * Import from here in the rest of the app:
 *   import { runStrategies, strategies } from '@/app/lib/strategies';
 */

export type { FinancialSnapshot, Strategy, StrategyResult, StrategyState } from './types';

export { augustaRule }   from './modules/augustaRule';
export { hireKids }      from './modules/hireKids';
export { backdoorRoth }  from './modules/backdoorRoth';

import { augustaRule }  from './modules/augustaRule';
import { hireKids }     from './modules/hireKids';
import { backdoorRoth } from './modules/backdoorRoth';
import type { Strategy, FinancialSnapshot, StrategyResult } from './types';

/** All registered strategies in priority display order. */
export const strategies: Strategy[] = [
  augustaRule,
  hireKids,
  backdoorRoth,
];

/**
 * Run every registered strategy against a snapshot and return the full
 * result set, sorted: ACTIVE → VERIFY → LOCKED → NOT_APPLICABLE.
 */
export function runStrategies(snapshot: FinancialSnapshot): StrategyResult[] {
  const ORDER: Record<string, number> = {
    ACTIVE:         0,
    VERIFY:         1,
    LOCKED:         2,
    NOT_APPLICABLE: 3,
  };

  return strategies
    .map(s => s.evaluate(snapshot))
    .sort((a, b) => (ORDER[a.state] ?? 9) - (ORDER[b.state] ?? 9));
}

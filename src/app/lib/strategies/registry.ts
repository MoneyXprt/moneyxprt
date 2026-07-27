import type { Strategy, FinancialSnapshot, StrategyResult } from './types';
import { augustaRule }      from './modules/augustaRule';
import { hireKids }         from './modules/hireKids';
import { backdoorRoth }     from './modules/backdoorRoth';
import { reps }             from './modules/reps';
import { depreciation }     from './modules/depreciation';
import { hsa }              from './modules/hsa';
import { megaBackdoorRoth } from './modules/megaBackdoorRoth';
import { soloK }            from './modules/soloK';
import { sCorpElection }    from './modules/sCorpElection';
import { qbi }              from './modules/qbi';
import { accountablePlan }  from './modules/accountablePlan';
import { homeOfficeDeduction } from './modules/homeOfficeDeduction';
import { startupCosts }        from './modules/startupCosts';

/**
 * All registered strategy modules.
 * Add new strategies here — evaluateAll picks them up automatically.
 */
export const registry: Strategy[] = [
  augustaRule,
  hireKids,
  backdoorRoth,
  reps,
  depreciation,
  hsa,
  megaBackdoorRoth,
  soloK,
  sCorpElection,
  qbi,
  accountablePlan,
  homeOfficeDeduction,
  startupCosts,
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

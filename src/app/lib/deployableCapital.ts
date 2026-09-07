import type { FinancialSnapshot } from './strategies/types';

// ─── Bonus plan / actuals ───────────────────────────────────────────────────
// Mirrors the bonus_plan / bonus_payments_actual tables
// (supabase/migrations/20260705000000_create_bonus_plan_tables.sql).

export type BonusFrequency = 'monthly' | 'quarterly' | 'annual';

export interface BonusPlan {
  frequency: BonusFrequency;
  planAmount: number;
  paymentMonth: number | null; // 1–12; only meaningful for quarterly/annual
}

export interface BonusPayment {
  amount: number;
  datePaid: Date;
  netAmount?: number; // actual take-home amount if known; falls back to estimated withholding
  deployableAmount?: number; // remaining amount still available after real-world spending; falls back to netAmount
}

function sum(amounts: number[]): number {
  return amounts.reduce((total, a) => total + a, 0);
}

/**
 * Estimated withholding on supplemental bonus income: 22% federal supplemental +
 * 10.23% CA supplemental + 2.35% Medicare/Additional Medicare Tax = 34.58%. Used only
 * as a fallback when a real net_amount hasn't been recorded for an actual payment, or
 * as a forward-looking net estimate for a plan amount that hasn't been paid yet.
 */
const BONUS_WITHHOLDING_RATE = 0.3458;

/**
 * Exported so any other caller needing a net-of-withholding estimate from a gross
 * bonus amount (e.g. applying an unlogged-net bonus payment toward debt) reuses this
 * exact rate instead of re-declaring the constant elsewhere and risking drift.
 */
export function estimateNetBonus(grossAmount: number): number {
  return grossAmount * (1 - BONUS_WITHHOLDING_RATE);
}

/**
 * Where a period's effective bonus amount came from:
 *  - 'actual'    — a logged payment with a recorded net_amount (real net, no estimate)
 *  - 'estimated' — the 34.58% withholding formula was applied, either to a logged
 *                  payment's gross amount (no net_amount recorded) or to the plan
 *                  amount (nothing logged yet)
 *  - 'none'      — period already passed with nothing logged; contributes $0
 */
export type BonusAmountSource = 'actual' | 'estimated' | 'none';

interface PeriodBonusResult {
  amount: number;
  source: BonusAmountSource;
}

/**
 * Effective net bonus for one quarterly/annual period: the recorded net_amount if one
 * lands in range, else that period's gross actual with estimated withholding applied,
 * else (no actual recorded) 0 for a period that's already passed (assume already
 * received/spent — not upcoming capital), else the plan estimate with estimated
 * withholding applied for a period that hasn't happened yet.
 *
 * Only ever called for quarterly/annual plans — monthly-frequency bonuses are handled
 * directly in computeAnnualBonusNetEstimate's own branch and never go through periods.
 */
function getEffectiveBonusForPeriod(
  plan: BonusPlan,
  actuals: BonusPayment[],
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): PeriodBonusResult {
  const actualInPeriod = actuals.filter(a => a.datePaid >= periodStart && a.datePaid <= periodEnd);
  if (actualInPeriod.length > 0) {
    const amount = sum(actualInPeriod.map(a => a.deployableAmount ?? a.netAmount ?? estimateNetBonus(a.amount)));
    const source: BonusAmountSource = actualInPeriod.every(a => a.netAmount != null) ? 'actual' : 'estimated';
    return { amount, source };
  }
  if (periodEnd < now) return { amount: 0, source: 'none' };
  return { amount: estimateNetBonus(plan.planAmount), source: 'estimated' };
}

/**
 * First-to-last-day date range for a given calendar month, anchored in UTC.
 *
 * BonusPayment.datePaid comes from `new Date(row.date_paid)` on a bare 'YYYY-MM-DD'
 * string, which the Date constructor parses as UTC midnight — not local midnight. If
 * this function built its boundaries with the local-time Date constructor instead, the
 * two would be offset by the local UTC offset (e.g. 7-8 hours behind in US timezones),
 * silently misattributing a payment made on the 1st of the month to the *previous*
 * period whenever comparisons run in a timezone behind UTC. Using Date.UTC here keeps
 * both sides of the comparison anchored to the same clock.
 */
function monthPeriod(year: number, month1to12: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month1to12 - 1, 1));
  const end   = new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
  return { start, end };
}

/**
 * The periods to evaluate for a quarterly/annual bonus plan, anchored to the current
 * calendar year. Quarterly derives all 4 quarters from paymentMonth at +3/+6/+9 month
 * offsets (naturally wrapping into next year); annual is the single occurrence at
 * paymentMonth this year. Returns [] if paymentMonth hasn't been set.
 */
function getBonusPeriods(plan: BonusPlan, now: Date): { start: Date; end: Date }[] {
  if (plan.paymentMonth == null) return [];
  const year = now.getFullYear();

  if (plan.frequency === 'annual') {
    return [monthPeriod(year, plan.paymentMonth)];
  }

  return [0, 3, 6, 9].map(offset => {
    const d = new Date(year, plan.paymentMonth! - 1 + offset, 1);
    return monthPeriod(d.getFullYear(), d.getMonth() + 1);
  });
}

/**
 * Annual net bonus estimate — always its own line item, never smoothed into a monthly
 * figure. Monthly plans contribute estimateNetBonus(planAmount) × 12 (net, for
 * consistency with quarterly/annual — previously this branch stayed gross, which was a
 * deliberate gap while getEffectiveBonusForPeriod was being converted to net; closed now
 * that bonus is fully split out from recurring take-home).
 *
 * Quarterly/annual plans sum only the currently-relevant periods (actual/net where
 * recorded, 0 for a passed period with nothing recorded, net plan estimate for an
 * upcoming period) — never a lump sum smeared evenly across all 12 months regardless of
 * timing.
 */
export function computeAnnualBonusNetEstimate(
  bonusPlan: BonusPlan | null,
  bonusPayments: BonusPayment[],
  now = new Date(),
): number {
  if (!bonusPlan) return 0;
  if (bonusPlan.frequency === 'monthly') return estimateNetBonus(bonusPlan.planAmount) * 12;

  const periods = getBonusPeriods(bonusPlan, now);
  return sum(periods.map(({ start, end }) =>
    getEffectiveBonusForPeriod(bonusPlan, bonusPayments, start, end, now).amount));
}

/**
 * Whether computeAnnualBonusNetEstimate's figure is a real recorded net amount or a
 * withholding-formula estimate — for UI labeling ("Bonus (actual, net)" vs "Bonus
 * (estimated, net of withholding)"), not for the calculation itself.
 *
 * Monthly plans are always 'estimated': monthly never checks bonus_payments_actual at
 * all (see getEffectiveBonusForPeriod's doc comment), so there's no "actual" case for
 * monthly regardless of what's logged.
 *
 * Quarterly/annual: a period that passed with nothing logged contributes $0 and is
 * excluded from this determination (it didn't use the formula, it's just absent). Of
 * the periods that did contribute money, this returns 'actual' only if every one of
 * them came from a logged net_amount — a single period relying on the formula (gross
 * actual with no net_amount, or a plan estimate for an upcoming period) makes the whole
 * total 'estimated', since it's no longer purely real numbers.
 */
export function computeAnnualBonusNetEstimateSource(
  bonusPlan: BonusPlan | null,
  bonusPayments: BonusPayment[],
  now = new Date(),
): BonusAmountSource {
  if (!bonusPlan) return 'none';
  if (bonusPlan.frequency === 'monthly') return 'estimated';

  const periods = getBonusPeriods(bonusPlan, now);
  const results = periods.map(({ start, end }) =>
    getEffectiveBonusForPeriod(bonusPlan, bonusPayments, start, end, now));
  const contributing = results.filter(r => r.source !== 'none');
  if (contributing.length === 0) return 'none';
  return contributing.every(r => r.source === 'actual') ? 'actual' : 'estimated';
}

// ─── Take-home / deployable capital ─────────────────────────────────────────

/**
 * Monthly take-home = (recurring gross annual income − taxes) / 12.
 *
 * Bonus income is deliberately excluded — it's irregular by nature and handled as its
 * own line item via computeAnnualBonusNetEstimate, never smoothed into this monthly
 * figure. See computeAnnualDeployableTotal for the combined annual view.
 */
export function computeMonthlyTakeHome(s: FinancialSnapshot): number {
  const grossAnnualRecurring =
    s.w2Income +
    s.income1099 +
    s.carAllowanceAnnual +
    s.otherIncomeAnnual +
    s.spouseW2Income +
    s.spouseBusinessNetProfit +
    (s.monthlyRentalIncome * 12) +
    (s.monthlyDividendIncome * 12);

  return Math.max(0, (grossAnnualRecurring - s.currentTaxPaid) / 12);
}

/**
 * Gross annual income before tax — used for ratio metrics (e.g. effective tax rate,
 * debt-to-income) rather than deployable-capital math. Extracted from
 * audit/snapshot-summary/page.tsx's local computeGrossAnnualIncome so every consumer
 * shares the exact same formula and the numbers can never disagree.
 */
export function computeGrossAnnualIncome(s: FinancialSnapshot): number {
  return s.w2Income + s.bonusTakenAsCash + s.income1099 + s.carAllowanceAnnual +
         s.otherIncomeAnnual + s.spouseW2Income + s.spouseBusinessNetProfit +
         (s.monthlyRentalIncome * 12) + (s.monthlyDividendIncome * 12);
}

/**
 * Monthly capital deployable toward assets: recurring take-home pay minus
 * essential/discretionary spend minus minimum debt payments across every debt type
 * minus any typical extra (above-minimum) debt payments the user reported minus
 * child support and alimony paid. No bonus — see computeAnnualDeployableTotal for
 * the figure that includes it.
 */
export function computeMonthlyDeployable(s: FinancialSnapshot): number {
  const monthlyTakeHome = computeMonthlyTakeHome(s);
  const monthlyMinDebtPayments =
    s.carLoanPayment +
    s.studentLoanPayment +
    s.personalLoanPayment +
    s.creditCardPayment +
    s.businessLoanPayment +
    s.otherDebtPayment;
  return Math.max(0, monthlyTakeHome - s.essentialMonthlySpend - s.discretionaryMonthlySpend - monthlyMinDebtPayments - s.extraDebtPayments - s.childSupportMonthly - s.alimonyMonthly);
}

/**
 * Total deployable capital for the year: recurring monthly deployable annualized, plus
 * the bonus net estimate as its own addend — this is the "Total this year" figure, and
 * the one that should feed downstream annual-capacity planning (e.g. phase2's
 * capitalPerYear), since it's the true full-year investable-capital estimate including
 * bonus. computeMonthlyDeployable alone (× 12) would understate it for anyone with a
 * bonus plan on file.
 */
export function computeAnnualDeployableTotal(
  s: FinancialSnapshot,
  bonusPlan: BonusPlan | null,
  bonusPayments: BonusPayment[],
  now = new Date(),
): number {
  return computeMonthlyDeployable(s) * 12 + computeAnnualBonusNetEstimate(bonusPlan, bonusPayments, now);
}

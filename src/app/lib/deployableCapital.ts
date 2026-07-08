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
}

function sum(amounts: number[]): number {
  return amounts.reduce((total, a) => total + a, 0);
}

/**
 * Effective bonus for one quarterly/annual period: the recorded actual if one lands in
 * range, else 0 for a period that's already passed with nothing recorded (assume already
 * received/spent — not upcoming capital), else the plan estimate for a period that hasn't
 * happened yet.
 *
 * Only ever called for quarterly/annual plans — monthly-frequency bonuses fold directly
 * into computeMonthlyTakeHome's recurring income calculation and never go through periods.
 */
function getEffectiveBonusForPeriod(
  plan: BonusPlan,
  actuals: BonusPayment[],
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): number {
  const actualInPeriod = actuals.filter(a => a.datePaid >= periodStart && a.datePaid <= periodEnd);
  if (actualInPeriod.length > 0) return sum(actualInPeriod.map(a => a.amount));
  return periodEnd < now ? 0 : plan.planAmount;
}

/** First-to-last-day date range for a given calendar month. */
function monthPeriod(year: number, month1to12: number): { start: Date; end: Date } {
  const start = new Date(year, month1to12 - 1, 1);
  const end   = new Date(year, month1to12, 0, 23, 59, 59, 999);
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
 * Annual bonus contribution folded into computeMonthlyTakeHome's gross-annual figure.
 *
 * Monthly plans contribute planAmount × 12 — algebraically identical to adding
 * planAmount directly to the final monthly take-home once divided back down by 12, so
 * a monthly bonus behaves exactly like "add plan_amount directly to recurring monthly
 * income," just expressed through the same annual-then-/12 path as every other income
 * source in this function.
 *
 * Quarterly/annual plans sum only the currently-relevant periods (actual where
 * recorded, 0 for a passed period with nothing recorded, plan estimate for an upcoming
 * period) — never a lump sum smeared evenly across all 12 months regardless of timing.
 */
function computeAnnualBonusContribution(
  bonusPlan: BonusPlan | null,
  bonusPayments: BonusPayment[],
  now: Date,
): number {
  if (!bonusPlan) return 0;
  if (bonusPlan.frequency === 'monthly') return bonusPlan.planAmount * 12;

  const periods = getBonusPeriods(bonusPlan, now);
  return sum(periods.map(({ start, end }) =>
    getEffectiveBonusForPeriod(bonusPlan, bonusPayments, start, end, now)));
}

// ─── Take-home / deployable capital ─────────────────────────────────────────

/**
 * Monthly take-home = (gross annual income − taxes) / 12.
 *
 * Bonus income no longer comes from the flat FinancialSnapshot.bonusTakenAsCash field —
 * it's derived from the user's bonus_plan row and any recorded bonus_payments_actual via
 * computeAnnualBonusContribution. Callers must fetch both from Supabase and pass them in;
 * there's no default here, since silently treating a missing bonus_plan as "$0 bonus" is
 * exactly the kind of hidden regression this signature change is meant to force callers
 * to address explicitly.
 */
export function computeMonthlyTakeHome(
  s: FinancialSnapshot,
  bonusPlan: BonusPlan | null,
  bonusPayments: BonusPayment[],
): number {
  const now = new Date();

  const grossAnnualExcludingBonus =
    s.w2Income +
    s.income1099 +
    s.carAllowanceAnnual +
    s.otherIncomeAnnual +
    s.spouseW2Income +
    s.spouseBusinessNetProfit +
    (s.monthlyRentalIncome * 12) +
    (s.monthlyDividendIncome * 12);

  const annualBonus = computeAnnualBonusContribution(bonusPlan, bonusPayments, now);
  const grossAnnual = grossAnnualExcludingBonus + annualBonus;

  return Math.max(0, (grossAnnual - s.currentTaxPaid) / 12);
}

/**
 * Monthly capital deployable toward assets: take-home pay minus essential/discretionary
 * spend minus minimum debt payments across every debt type minus any typical extra
 * (above-minimum) debt payments the user reported.
 */
export function computeMonthlyDeployable(
  s: FinancialSnapshot,
  bonusPlan: BonusPlan | null,
  bonusPayments: BonusPayment[],
): number {
  const monthlyTakeHome = computeMonthlyTakeHome(s, bonusPlan, bonusPayments);
  const monthlyMinDebtPayments =
    s.carLoanPayment +
    s.studentLoanPayment +
    s.personalLoanPayment +
    s.creditCardPayment +
    s.businessLoanPayment +
    s.otherDebtPayment;
  return Math.max(0, monthlyTakeHome - s.essentialMonthlySpend - s.discretionaryMonthlySpend - monthlyMinDebtPayments - s.extraDebtPayments);
}

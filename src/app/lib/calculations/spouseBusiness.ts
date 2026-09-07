/**
 * Spouse Business life event — pure calculation engine.
 *
 * Takes the answers from the 4-question flow (plus a few optional details from a
 * prior full audit) and returns an ordered list of tax strategies with a real
 * dollar value for each one we can compute, or a precise "add this to unlock"
 * message for the ones that need one more number.
 *
 * Design rules honoured here:
 *  - Zero side effects, zero I/O, zero React. Every value is derived from the
 *    argument. The repository maps Supabase rows into {@link SpouseBusinessInputs};
 *    the results screen only renders what this returns.
 *  - Revenue-tier and unlock logic are data ({@link REVENUE_TIERS},
 *    {@link SPOUSE_BUSINESS_STRATEGIES}) — no scattered `if (revenue > x)` chains.
 *  - All thresholds/rates come from {@link ./spouseBusinessConstants} or the
 *    app's {@link ../strategies/taxConstants2026}.
 *  - Nullable-tolerant: missing revenue, expenses, or marginal rate never throw.
 */

import { formatCurrency } from '../format';
import {
  QBI_DEDUCTION_RATE,
  CONTRIBUTION_LIMITS,
  SE_TAX_RATE,
  SE_TAX_DEDUCTIBLE_FRACTION,
  KID_STANDARD_DEDUCTION,
  AUGUSTA_RULE_MAX_DAYS,
  AUGUSTA_RULE_DAILY_RATE,
  SCORP_REVENUE_THRESHOLD,
} from '../strategies/taxConstants2026';
import {
  REVENUE_TIERS,
  type RevenueTier,
  type SpouseBusinessExpenseCategory,
  type FamilyInvolvement,
  EXPENSE_CATEGORIES,
  FAMILY_INVOLVEMENT_OPTIONS,
  ASSUMED_NET_PROFIT_MARGIN,
  FALLBACK_MARGINAL_RATE,
  ASSUMED_CHILDREN_ON_PAYROLL,
  PAYROLL_REVENUE_FRACTION,
  HOME_OFFICE_SIMPLIFIED_RATE_PER_SQFT,
  HOME_OFFICE_SIMPLIFIED_SQFT_CAP,
  SECTION_179_VEHICLE_CAP,
  SECTION_179_BUSINESS_USE_FLOOR_PCT,
  SCORP_DISTRIBUTION_FRACTION,
  SCORP_ELECTION_DEADLINE,
} from './spouseBusinessConstants';

// ─── Public types ───────────────────────────────────────────────────────────

export type { RevenueTier, RevenueTierId } from './spouseBusinessConstants';
export type { SpouseBusinessExpenseCategory, FamilyInvolvement } from './spouseBusinessConstants';

export type SpouseBusinessStrategyCategory =
  | 'tax'
  | 'retirement'
  | 'businessStructure'
  | 'family';

/**
 * Raw input to the engine. Every field is nullable/optional — the flow may only
 * have answered some questions, and the snapshot detail fields are only present
 * for users who completed the full audit.
 */
export interface SpouseBusinessInputs {
  /** Spouse business revenue per month, in dollars (Screen 2). */
  monthlyRevenue: number | null | undefined;
  /** Expense categories checked in Screen 3. */
  expenseCategories: readonly SpouseBusinessExpenseCategory[] | null | undefined;
  /** Who helps with the business (Screen 4). */
  familyInvolvement: FamilyInvolvement | null | undefined;
  /** Household combined marginal tax rate as a 0–1 fraction. */
  marginalRate: number | null | undefined;
  /** Filing status — defaults to `mfj` when unknown. */
  filingStatus?: 'single' | 'mfj' | null;
  /** Dependents under 18 on file, for the hire-your-children estimate. */
  dependentsUnder18?: number | null;
  /** Whether the household owns their home (Augusta Rule relevance). */
  ownsHome?: boolean | null;
  /** Home office size from a prior audit — unlocks the home-office value. */
  homeOfficeSquareFootage?: number | null;
  /** Business vehicle purchase price from a prior audit — unlocks §179. */
  vehiclePurchaseAmount?: number | null;
  /** Documented business-use % of that vehicle (0–100). */
  vehicleBusinessUsePercent?: number | null;
}

/** One strategy in the results list. Matches the results-screen card contract. */
export interface SpouseBusinessStrategy {
  id: string;
  name: string;
  category: SpouseBusinessStrategyCategory;
  /** One plain-English sentence — no tax-code citations. */
  description: string;
  /** Calculated annual tax saving in whole dollars. `0` when not unlocked. */
  annualSavings: number;
  /** Action deadline, or `null` if the strategy has no dated deadline. */
  deadline: Date | null;
  /** Longer explanation for the "Learn more" expander. */
  learnMore: string;
  /** `true` when we could compute a real value from the data provided. */
  unlocked: boolean;
  /** When not unlocked: exactly what the user needs to add. Empty when unlocked. */
  unlockCondition: string;
}

// ─── Normalisation ──────────────────────────────────────────────────────────

interface NormalizedInputs {
  monthlyRevenue: number;
  expenseCategories: Set<SpouseBusinessExpenseCategory>;
  familyInvolvement: FamilyInvolvement;
  /** `null` when the real rate was missing/unusable — context applies the fallback. */
  marginalRate: number | null;
  filingStatus: 'single' | 'mfj';
  dependentsUnder18: number;
  ownsHome: boolean;
  homeOfficeSquareFootage: number;
  vehiclePurchaseAmount: number;
  vehicleBusinessUsePercent: number;
}

const KNOWN_EXPENSE_IDS = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.id));
const KNOWN_INVOLVEMENT_IDS = new Set<string>(FAMILY_INVOLVEMENT_OPTIONS.map((o) => o.id));

/** Coerce anything to a finite number `>= 0`, else `0`. */
function toNonNegativeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** A marginal rate is only usable if it's a 0–1 fraction that isn't zero. */
function isUsableRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1;
}

/**
 * Turn the loose, partially-missing raw input into a fully-defined shape.
 * Exported so the "missing field" edge cases can be tested directly.
 */
export function normalizeSpouseBusinessInputs(input: SpouseBusinessInputs): NormalizedInputs {
  const expenseCategories = Array.isArray(input.expenseCategories)
    ? input.expenseCategories.filter((c): c is SpouseBusinessExpenseCategory =>
        KNOWN_EXPENSE_IDS.has(c),
      )
    : [];

  const involvement =
    typeof input.familyInvolvement === 'string' && KNOWN_INVOLVEMENT_IDS.has(input.familyInvolvement)
      ? (input.familyInvolvement as FamilyInvolvement)
      : 'spouse_only';

  return {
    monthlyRevenue: toNonNegativeNumber(input.monthlyRevenue),
    expenseCategories: new Set(expenseCategories),
    familyInvolvement: involvement,
    marginalRate: isUsableRate(input.marginalRate) ? input.marginalRate : null,
    filingStatus: input.filingStatus === 'single' ? 'single' : 'mfj',
    dependentsUnder18: Math.floor(toNonNegativeNumber(input.dependentsUnder18)),
    ownsHome: input.ownsHome === true,
    homeOfficeSquareFootage: toNonNegativeNumber(input.homeOfficeSquareFootage),
    vehiclePurchaseAmount: toNonNegativeNumber(input.vehiclePurchaseAmount),
    vehicleBusinessUsePercent: Math.min(100, toNonNegativeNumber(input.vehicleBusinessUsePercent)),
  };
}

// ─── Revenue tier ───────────────────────────────────────────────────────────

/**
 * The revenue tier for a given annual revenue. Reads {@link REVENUE_TIERS} —
 * boundary convention: exactly $12,000/yr is `startup`, exactly $50,000/yr is
 * `growing`. Non-finite or negative input is treated as `0` (`none`).
 */
export function getRevenueTier(annualRevenue: number): RevenueTier {
  const revenue = Number.isFinite(annualRevenue) && annualRevenue > 0 ? annualRevenue : 0;
  return (
    REVENUE_TIERS.find((tier) => revenue <= tier.maxAnnualRevenueInclusive) ??
    REVENUE_TIERS[REVENUE_TIERS.length - 1]
  );
}

// ─── Derived context ────────────────────────────────────────────────────────

interface StrategyContext extends NormalizedInputs {
  annualRevenue: number;
  estimatedNetProfit: number;
  effectiveMarginalRate: number;
  marginalRateIsEstimated: boolean;
  tier: RevenueTier;
  childrenOnPayroll: number;
  taxYear: number;
  yearEndDeadline: Date;
  scorpElectionDeadline: Date;
}

function buildContext(n: NormalizedInputs, now: Date): StrategyContext {
  const taxYear = now.getFullYear();
  const annualRevenue = n.monthlyRevenue * 12;

  // S-Corp election (Form 2553) is due March 15 of the tax year; if that date has
  // already passed, the next actionable deadline is next year's.
  const thisYearScorp = new Date(taxYear, SCORP_ELECTION_DEADLINE.month, SCORP_ELECTION_DEADLINE.day);
  const scorpElectionDeadline =
    thisYearScorp.getTime() >= now.getTime()
      ? thisYearScorp
      : new Date(taxYear + 1, SCORP_ELECTION_DEADLINE.month, SCORP_ELECTION_DEADLINE.day);

  return {
    ...n,
    annualRevenue,
    estimatedNetProfit: annualRevenue * ASSUMED_NET_PROFIT_MARGIN,
    effectiveMarginalRate: n.marginalRate ?? FALLBACK_MARGINAL_RATE,
    marginalRateIsEstimated: n.marginalRate === null,
    tier: getRevenueTier(annualRevenue),
    childrenOnPayroll: n.dependentsUnder18 > 0 ? n.dependentsUnder18 : ASSUMED_CHILDREN_ON_PAYROLL,
    taxYear,
    yearEndDeadline: new Date(taxYear, 11, 31),
    scorpElectionDeadline,
  };
}

// ─── Strategy catalogue (data, not conditionals) ────────────────────────────

interface StrategyDefinition {
  id: string;
  name: string;
  category: SpouseBusinessStrategyCategory;
  learnMore: string;
  /** Message shown when the strategy is relevant but not yet unlocked. */
  unlockCondition: string;
  /** Is this strategy worth showing at all for this user? */
  isRelevant: (ctx: StrategyContext) => boolean;
  /** Can we compute a real dollar value from what the user gave us? */
  isUnlocked: (ctx: StrategyContext) => boolean;
  /** Annual tax saving, in dollars (only called when unlocked). */
  annualSavings: (ctx: StrategyContext) => number;
  /** Dated deadline, or `null`. */
  deadline: (ctx: StrategyContext) => Date | null;
  /** One-sentence, plain-English description; `savings` is the rounded result. */
  describe: (ctx: StrategyContext, savings: number) => string;
}

/** Local alias — all money in descriptions goes through the shared formatter. */
const money = formatCurrency;
const rateEstimateNote = (ctx: StrategyContext) =>
  ctx.marginalRateIsEstimated ? ' (estimated — confirm your tax rate to refine)' : '';

/** Solo 401(k) / SEP allowable contribution on the estimated net profit. */
function soloRetirementContribution(ctx: StrategyContext): number {
  const netSelfEmploymentEarnings = ctx.estimatedNetProfit * SE_TAX_DEDUCTIBLE_FRACTION;
  const employeeDeferral = Math.min(CONTRIBUTION_LIMITS.k401, netSelfEmploymentEarnings);
  const employerShare = Math.min(
    netSelfEmploymentEarnings * 0.25,
    CONTRIBUTION_LIMITS.sepIraMax - employeeDeferral,
  );
  return Math.min(employeeDeferral + employerShare, netSelfEmploymentEarnings);
}

export const SPOUSE_BUSINESS_STRATEGIES: readonly StrategyDefinition[] = [
  {
    id: 'qbi',
    name: 'Take the 20% business income deduction',
    category: 'tax',
    learnMore:
      'The qualified business income deduction lets pass-through business owners deduct up to ' +
      '20% of their business profit straight off taxable income. It costs nothing to use — you ' +
      'just have to report the income on a Schedule C or K-1. It reduces income tax only, not ' +
      'self-employment tax, and can be limited at very high household income.',
    unlockCondition: 'Add the business’s monthly revenue so we can size the deduction.',
    isRelevant: () => true,
    isUnlocked: (ctx) => ctx.annualRevenue > 0,
    annualSavings: (ctx) => ctx.estimatedNetProfit * QBI_DEDUCTION_RATE * ctx.effectiveMarginalRate,
    deadline: () => null,
    describe: (ctx, savings) =>
      `Deduct 20% of the business’s profit — about ${money(
        ctx.estimatedNetProfit * QBI_DEDUCTION_RATE,
      )} off your taxable income, worth roughly ${money(savings)} a year at your tax rate${rateEstimateNote(
        ctx,
      )}.`,
  },
  {
    id: 'solo-401k',
    name: 'Open a solo 401(k) for the business',
    category: 'retirement',
    learnMore:
      'A business with self-employment income can open a solo 401(k) (or SEP IRA) and contribute ' +
      'far more than a regular workplace plan allows — an employee portion plus an employer ' +
      'profit-sharing portion of up to 25% of net earnings. Every dollar contributed comes ' +
      'straight off taxable income this year. The account must be opened by December 31.',
    unlockCondition: 'Add the business’s monthly revenue so we can size the contribution.',
    isRelevant: () => true,
    isUnlocked: (ctx) => ctx.annualRevenue > 0,
    annualSavings: (ctx) => soloRetirementContribution(ctx) * ctx.effectiveMarginalRate,
    deadline: (ctx) => ctx.yearEndDeadline,
    describe: (ctx, savings) =>
      `Contribute up to about ${money(
        soloRetirementContribution(ctx),
      )} of the business’s earnings to a solo 401(k) and cut this year’s tax bill by roughly ${money(
        savings,
      )}${rateEstimateNote(ctx)}.`,
  },
  {
    id: 'hire-children',
    name: 'Put your kids on the payroll',
    category: 'family',
    learnMore:
      'If your children do real, age-appropriate work for the business, you can pay them a ' +
      'reasonable wage. The business deducts it, and each child owes no federal income tax on ' +
      'wages up to their standard deduction. Keep a timesheet and pay them like any employee. ' +
      'Wages must be paid during the tax year.',
    unlockCondition: 'Add the business’s monthly revenue so we can size the wages.',
    isRelevant: (ctx) => ctx.familyInvolvement === 'kids_help',
    isUnlocked: (ctx) => ctx.familyInvolvement === 'kids_help' && ctx.annualRevenue > 0,
    annualSavings: (ctx) => {
      const wagePerChild = Math.min(
        KID_STANDARD_DEDUCTION,
        (ctx.annualRevenue * PAYROLL_REVENUE_FRACTION) / ctx.childrenOnPayroll,
      );
      return wagePerChild * ctx.effectiveMarginalRate * ctx.childrenOnPayroll;
    },
    deadline: (ctx) => ctx.yearEndDeadline,
    describe: (ctx, savings) => {
      const noun = ctx.childrenOnPayroll === 1 ? 'child' : 'children';
      return `Pay your ${ctx.childrenOnPayroll} ${noun} for real work in the business and move about ${money(
        savings,
      )} a year off your tax bill and onto their tax-free bracket${rateEstimateNote(ctx)}.`;
    },
  },
  {
    id: 'augusta-rule',
    name: 'Rent your home to the business',
    category: 'tax',
    learnMore:
      'You can rent your personal home to your own business for up to 14 days a year for ' +
      'legitimate meetings or events. The business deducts the payments, and the rental income ' +
      'is completely tax-free to you. Document the business purpose and use a fair market rate. ' +
      'The days and payment must fall within the tax year.',
    unlockCondition: 'Add the business’s monthly revenue so we can confirm this is worth doing.',
    isRelevant: (ctx) => ctx.ownsHome,
    isUnlocked: (ctx) => ctx.ownsHome && ctx.annualRevenue > 0,
    annualSavings: (ctx) =>
      AUGUSTA_RULE_DAILY_RATE * AUGUSTA_RULE_MAX_DAYS * ctx.effectiveMarginalRate,
    deadline: (ctx) => ctx.yearEndDeadline,
    describe: (ctx, savings) =>
      `Have the business pay you ${money(AUGUSTA_RULE_DAILY_RATE)}/day to use your home for up to ${AUGUSTA_RULE_MAX_DAYS} days — ` +
      `about ${money(
        AUGUSTA_RULE_DAILY_RATE * AUGUSTA_RULE_MAX_DAYS,
      )} of tax-free income and roughly ${money(savings)} in tax savings${rateEstimateNote(ctx)}.`,
  },
  {
    id: 'home-office',
    name: 'Deduct the home office',
    category: 'tax',
    learnMore:
      'A space used regularly and exclusively for the business earns a deduction. The simplified ' +
      `method is $${HOME_OFFICE_SIMPLIFIED_RATE_PER_SQFT}/sq ft on up to ${HOME_OFFICE_SIMPLIFIED_SQFT_CAP} sq ft — no receipts, ` +
      'but no personal use of the space, ever. The space must be in use by December 31 to count ' +
      'this year.',
    unlockCondition:
      'Add the home office’s size (square feet) in the full audit to calculate this deduction.',
    isRelevant: (ctx) => ctx.expenseCategories.has('home_office'),
    isUnlocked: (ctx) => ctx.expenseCategories.has('home_office') && ctx.homeOfficeSquareFootage > 0,
    annualSavings: (ctx) => {
      const deductibleSqft = Math.min(ctx.homeOfficeSquareFootage, HOME_OFFICE_SIMPLIFIED_SQFT_CAP);
      return deductibleSqft * HOME_OFFICE_SIMPLIFIED_RATE_PER_SQFT * ctx.effectiveMarginalRate;
    },
    deadline: (ctx) => ctx.yearEndDeadline,
    describe: (ctx, savings) => {
      const deductibleSqft = Math.min(ctx.homeOfficeSquareFootage, HOME_OFFICE_SIMPLIFIED_SQFT_CAP);
      return `Your ${Math.round(deductibleSqft)} sq ft office is a ${money(
        deductibleSqft * HOME_OFFICE_SIMPLIFIED_RATE_PER_SQFT,
      )} deduction — about ${money(savings)} in tax savings${rateEstimateNote(ctx)}.`;
    },
  },
  {
    id: 'section-179',
    name: 'Write off equipment and vehicles this year',
    category: 'tax',
    learnMore:
      'Section 179 lets a business deduct the full cost of qualifying equipment and heavy ' +
      'vehicles in the year they’re put into use, instead of depreciating over years. Vehicles ' +
      'need documented business use above 50% and a mileage log. The item must be in service by ' +
      'December 31.',
    unlockCondition:
      'Add what was spent on equipment or a business vehicle (and its business-use %) in the full audit.',
    isRelevant: (ctx) =>
      ctx.expenseCategories.has('equipment') || ctx.expenseCategories.has('vehicle'),
    isUnlocked: (ctx) =>
      (ctx.expenseCategories.has('equipment') || ctx.expenseCategories.has('vehicle')) &&
      ctx.vehiclePurchaseAmount > 0 &&
      ctx.vehicleBusinessUsePercent > SECTION_179_BUSINESS_USE_FLOOR_PCT,
    annualSavings: (ctx) => {
      const deductible = Math.min(
        ctx.vehiclePurchaseAmount * (ctx.vehicleBusinessUsePercent / 100),
        SECTION_179_VEHICLE_CAP,
      );
      return deductible * ctx.effectiveMarginalRate;
    },
    deadline: (ctx) => ctx.yearEndDeadline,
    describe: (ctx, savings) => {
      const deductible = Math.min(
        ctx.vehiclePurchaseAmount * (ctx.vehicleBusinessUsePercent / 100),
        SECTION_179_VEHICLE_CAP,
      );
      return `Deduct ${money(deductible)} of your ${money(
        ctx.vehiclePurchaseAmount,
      )} vehicle now instead of over six years — about ${money(savings)} in tax savings this year${rateEstimateNote(
        ctx,
      )}.`;
    },
  },
  {
    id: 's-corp-election',
    name: 'Elect S-corp status to cut self-employment tax',
    category: 'businessStructure',
    learnMore:
      'An S-corp election splits business income into a reasonable salary (which pays payroll ' +
      'tax) and distributions (which don’t). The distribution portion escapes the 15.3% ' +
      'self-employment tax. It only pays once revenue is high enough to cover payroll and a ' +
      'separate tax return — roughly $50,000/year. The election (Form 2553) is due March 15.',
    unlockCondition: `Unlocks at ${money(
      SCORP_REVENUE_THRESHOLD,
    )}/year in revenue — below that, S-corp payroll and filing costs outweigh the savings.`,
    isRelevant: () => true,
    isUnlocked: (ctx) => ctx.tier.id === 'established',
    annualSavings: (ctx) => ctx.annualRevenue * SCORP_DISTRIBUTION_FRACTION * SE_TAX_RATE,
    deadline: (ctx) => ctx.scorpElectionDeadline,
    describe: (ctx, savings) =>
      ctx.tier.id === 'established'
        ? `Take part of the ${money(
            ctx.annualRevenue,
          )} revenue as distributions instead of salary and save about ${money(
            savings,
          )} a year in self-employment tax.`
        : `Once revenue passes ${money(
            SCORP_REVENUE_THRESHOLD,
          )}/year, an S-corp election can save thousands a year in self-employment tax.`,
  },
] as const;

// ─── Engine ─────────────────────────────────────────────────────────────────

function resolveStrategy(def: StrategyDefinition, ctx: StrategyContext): SpouseBusinessStrategy {
  const unlocked = def.isUnlocked(ctx);
  const annualSavings = unlocked ? Math.max(0, Math.round(def.annualSavings(ctx))) : 0;
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    description: def.describe(ctx, annualSavings),
    annualSavings,
    deadline: unlocked ? def.deadline(ctx) : null,
    learnMore: def.learnMore,
    unlocked,
    unlockCondition: unlocked ? '' : def.unlockCondition,
  };
}

/** Unlocked strategies first, then by annual savings descending, then by name. */
function compareStrategies(a: SpouseBusinessStrategy, b: SpouseBusinessStrategy): number {
  if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
  if (a.annualSavings !== b.annualSavings) return b.annualSavings - a.annualSavings;
  return a.name.localeCompare(b.name);
}

/**
 * Evaluate every relevant spouse-business strategy for the given inputs.
 *
 * @param input   Answers from the flow, plus optional audit detail.
 * @param options `now` overrides the current date (used for deterministic
 *                deadline tests). Defaults to `new Date()`.
 * @returns Strategies ordered for display: unlocked (highest saving first), then
 *          locked "unlock as you grow" strategies.
 */
export function evaluateSpouseBusinessStrategies(
  input: SpouseBusinessInputs,
  options: { now?: Date } = {},
): SpouseBusinessStrategy[] {
  const ctx = buildContext(normalizeSpouseBusinessInputs(input), options.now ?? new Date());
  return SPOUSE_BUSINESS_STRATEGIES.filter((def) => def.isRelevant(ctx))
    .map((def) => resolveStrategy(def, ctx))
    .sort(compareStrategies);
}

/** Total annual savings across the unlocked strategies only. */
export function sumUnlockedAnnualSavings(strategies: readonly SpouseBusinessStrategy[]): number {
  return strategies.reduce((total, s) => total + (s.unlocked ? s.annualSavings : 0), 0);
}

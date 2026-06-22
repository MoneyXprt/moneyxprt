/**
 * taxConstants2026.ts
 *
 * Single source of truth for all 2026 federal tax numbers.
 * Update this file each year — all strategy modules reference only these exports.
 *
 * Sources: IRS Rev. Proc. 2025-61 (inflation adjustments for 2026),
 * IRC §§ 1, 25B, 72, 219, 280A, 401, 408A, 1402; FICA §§ 3101-3111.
 */

import type { FinancialSnapshot } from './types';

export const TAX_YEAR = 2026;

// ─── Standard deductions ────────────────────────────────────────────────────

export const STANDARD_DEDUCTION = {
  single: 15_750,
  mfj:    31_500,
} as const;

// ─── Federal income tax brackets ────────────────────────────────────────────
// Each entry: taxable income *above* `over` is taxed at `rate`.
// Assumes TCJA rates extended into 2026 with inflation adjustment.

export const BRACKETS: Record<'single' | 'mfj', { over: number; rate: number }[]> = {
  single: [
    { over: 0,        rate: 0.10 },
    { over: 12_200,   rate: 0.12 },
    { over: 49_500,   rate: 0.22 },
    { over: 105_900,  rate: 0.24 },
    { over: 201_800,  rate: 0.32 },
    { over: 255_900,  rate: 0.35 },
    { over: 639_600,  rate: 0.37 },
  ],
  mfj: [
    { over: 0,        rate: 0.10 },
    { over: 24_400,   rate: 0.12 },
    { over: 99_000,   rate: 0.22 },
    { over: 211_800,  rate: 0.24 },
    { over: 403_600,  rate: 0.32 },
    { over: 511_800,  rate: 0.35 },
    { over: 767_600,  rate: 0.37 },
  ],
};

// ─── Retirement & account contribution limits ────────────────────────────────

export const CONTRIBUTION_LIMITS = {
  k401:               24_500,  // employee elective deferral
  k401CatchUp:        32_000,  // age 50+ (includes standard limit)
  ira:                 7_000,  // traditional & Roth combined
  iraCatchUp:          8_000,  // age 50+
  hsaSelf:             4_400,  // self-only HDHP coverage
  hsaFamily:           8_750,  // family HDHP coverage
  sepIraMax:          70_000,  // §415 annual additions limit
  simpleIra:          16_500,  // SIMPLE IRA elective deferrals
  megaBackdoorRoth:   46_500,  // after-tax 401k headroom (§415 max − employee deferral)
} as const;

// ─── Roth IRA income phaseout ranges ────────────────────────────────────────
// Contribution ability phases out linearly between start and end.

export const ROTH_PHASEOUT = {
  single: { start: 155_000, end: 170_000 },
  mfj:    { start: 245_000, end: 255_000 },
} as const;

// ─── Real estate ─────────────────────────────────────────────────────────────

/** Residential rental property depreciation life (IRC §168(c)). */
export const DEPRECIATION_PERIOD_YEARS = 27.5;

// ─── Augusta Rule (IRC §280A(g)) ────────────────────────────────────────────

/** Maximum days a homeowner can rent to their own business tax-free. */
export const AUGUSTA_RULE_MAX_DAYS = 14;

/** Conservative market daily rate used for value estimates. */
export const AUGUSTA_RULE_DAILY_RATE = 400;

// ─── Family employment ───────────────────────────────────────────────────────

/**
 * A child's wages up to this amount are fully sheltered by their own
 * standard deduction — no federal income tax owed.
 * Specified by user as $14,600 for 2026.
 */
export const KID_STANDARD_DEDUCTION = 14_600;

/**
 * Fraction of business revenue conservatively available for family payroll.
 * Used when the caller hasn't provided an explicit payroll budget.
 */
export const FAMILY_PAYROLL_REVENUE_FRACTION = 0.20;

// ─── Self-employment tax ────────────────────────────────────────────────────

/** Combined OASDI + HI rate on net self-employment earnings. */
export const SE_TAX_RATE = 0.153;

/** Net earnings subject to SE tax = gross × this factor (accounts for ½ SE deduction). */
export const SE_TAX_DEDUCTIBLE_FRACTION = 0.9235;

// ─── Projection assumptions ──────────────────────────────────────────────────

/** Annualised long-run real + nominal return assumption for portfolio projections (%). */
export const GROWTH_ASSUMPTION_PCT = 6.5;

/** Approximate long-term capital-gains rate used in after-tax drag calculations. */
export const LTCG_RATE = 0.15;

/** Default projection horizon (years) for Roth / retirement value estimates. */
export const DEFAULT_PROJECTION_YEARS = 20;

// ─── State income tax rates ───────────────────────────────────────────────────
// Simplified marginal-rate lookup keyed by 2-letter state abbreviation.
// Each entry is an array of tiers sorted ascending by `over`; the highest
// tier whose `over` threshold the income clears is the marginal rate.
// Add or expand entries here as needed — getMarginalRate picks them up
// automatically. States not listed default to 0%.

export interface StateTaxTier {
  over: number;   // taxable income must exceed this to apply `rate`
  rate: number;
}

export const STATE_TAX_RATES: Record<string, StateTaxTier[]> = {
  // California — simplified; 9.3% kicks in above ~$70k (single or joint)
  CA: [
    { over:       0, rate: 0.010 },
    { over:  70_000, rate: 0.093 },
  ],

  // No-income-tax states
  AK: [{ over: 0, rate: 0 }],
  FL: [{ over: 0, rate: 0 }],
  NV: [{ over: 0, rate: 0 }],
  NH: [{ over: 0, rate: 0 }],  // wages only (interest/dividends tax repealed 2025)
  SD: [{ over: 0, rate: 0 }],
  TN: [{ over: 0, rate: 0 }],
  TX: [{ over: 0, rate: 0 }],
  WA: [{ over: 0, rate: 0 }],
  WY: [{ over: 0, rate: 0 }],
};

/** Default rate for states not listed in STATE_TAX_RATES. */
const DEFAULT_STATE_RATE = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the state marginal income tax rate for the given income and state. */
export function getStateMarginalRate(taxableIncome: number, state: string): number {
  const tiers = STATE_TAX_RATES[state.toUpperCase()];
  if (!tiers) return DEFAULT_STATE_RATE;
  let rate = 0;
  for (const tier of tiers) {
    if (taxableIncome > tier.over) rate = tier.rate;
  }
  return rate;
}

/** Returns the federal marginal income tax rate only. */
export function getFederalMarginalRate(
  taxableIncome: number,
  filingStatus: 'single' | 'mfj',
): number {
  const brackets = BRACKETS[filingStatus];
  let rate = brackets[0].rate;
  for (const bracket of brackets) {
    if (taxableIncome > bracket.over) rate = bracket.rate;
  }
  return rate;
}

/**
 * Returns the combined marginal rate: federal bracket + state marginal rate.
 * Use this everywhere a marginal rate is needed in strategy modules.
 */
export function getMarginalRate(
  taxableIncome: number,
  filingStatus: 'single' | 'mfj',
  state: string,
): number {
  return getFederalMarginalRate(taxableIncome, filingStatus)
       + getStateMarginalRate(taxableIncome, state);
}

/**
 * Approximates federal taxable income from a FinancialSnapshot using the
 * standard deduction. Does not model itemised deductions, QBI, or SALT.
 */
export function getTaxableIncome(s: FinancialSnapshot): number {
  const grossIncome = s.w2Income + s.bonusIncome + s.income1099;
  return Math.max(0, grossIncome - STANDARD_DEDUCTION[s.filingStatus]);
}

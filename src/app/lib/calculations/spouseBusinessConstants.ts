/**
 * Spouse Business life event — tunable constants, revenue tiers, and the
 * strategy catalogue's numeric assumptions.
 *
 * Hard IRS numbers (brackets, SE-tax rate, statutory caps, the Augusta Rule day
 * limit, the child standard deduction, the S-Corp cost threshold) are imported
 * from `strategies/taxConstants2026.ts` — the app's single source of truth for
 * tax figures. This file holds only the product-level assumptions specific to
 * modelling a spouse's small business from the four questions the flow asks, so
 * they can be reviewed and tuned in one place without touching calculation
 * logic.
 */

import {
  SCORP_REVENUE_THRESHOLD,
  FAMILY_PAYROLL_REVENUE_FRACTION,
} from '../strategies/taxConstants2026';

// ─── Expense categories (Screen 3) ──────────────────────────────────────────

/** Stable ids for the "what does the business spend money on?" checklist. */
export type SpouseBusinessExpenseCategory =
  | 'equipment'
  | 'home_office'
  | 'vehicle'
  | 'supplies'
  | 'phone_internet'
  | 'other';

/** Checklist definition — drives Screen 3's options and the results catalogue. */
export const EXPENSE_CATEGORIES: readonly {
  id: SpouseBusinessExpenseCategory;
  emoji: string;
  label: string;
}[] = [
  { id: 'equipment', emoji: '🖨', label: 'Equipment or machinery' },
  { id: 'home_office', emoji: '🏠', label: 'Home office space' },
  { id: 'vehicle', emoji: '🚗', label: 'Vehicle or mileage' },
  { id: 'supplies', emoji: '📦', label: 'Supplies and materials' },
  { id: 'phone_internet', emoji: '📱', label: 'Phone and internet' },
  { id: 'other', emoji: '💼', label: 'Other expenses' },
] as const;

// ─── Family involvement (Screen 4) ──────────────────────────────────────────

/** Stable ids for "does anyone help with the business?". */
export type FamilyInvolvement = 'spouse_only' | 'kids_help' | 'others_help';

export const FAMILY_INVOLVEMENT_OPTIONS: readonly {
  id: FamilyInvolvement;
  emoji: string;
  label: string;
}[] = [
  { id: 'spouse_only', emoji: '👤', label: 'Just my spouse' },
  { id: 'kids_help', emoji: '👨‍👩‍👧', label: 'Our kids help too' },
  { id: 'others_help', emoji: '👥', label: 'Other people help' },
] as const;

// ─── Revenue tiers ──────────────────────────────────────────────────────────

/** Which tier a spouse business falls into by annual revenue. */
export type RevenueTierId = 'none' | 'startup' | 'growing' | 'established';

export interface RevenueTier {
  id: RevenueTierId;
  /** Plain-English label for the tier. */
  label: string;
  /**
   * The tier applies when annual revenue is `<= maxAnnualRevenueInclusive` and
   * no earlier (lower) tier matched. Tiers are ordered ascending; the top tier
   * uses `Infinity`. Boundary convention: exactly $12,000/yr is "startup",
   * exactly $50,000/yr is "growing".
   */
  maxAnnualRevenueInclusive: number;
}

/**
 * Revenue tier table. Adding or re-banding a tier is a data edit here — the
 * calculation and the strategy unlock rules read tiers, they never hardcode
 * dollar thresholds.
 */
export const REVENUE_TIERS: readonly RevenueTier[] = [
  { id: 'none', label: 'No revenue yet', maxAnnualRevenueInclusive: 0 },
  { id: 'startup', label: 'Getting started', maxAnnualRevenueInclusive: 12_000 },
  // Upper bound of "growing" is the S-Corp cost-effectiveness threshold, so the
  // two can never drift apart.
  { id: 'growing', label: 'Growing', maxAnnualRevenueInclusive: SCORP_REVENUE_THRESHOLD },
  { id: 'established', label: 'Established', maxAnnualRevenueInclusive: Number.POSITIVE_INFINITY },
] as const;

// ─── Modelling assumptions (product decisions, not IRS numbers) ──────────────

/**
 * Net profit as a fraction of revenue, used when only revenue is known (the
 * flow asks for revenue, not a full P&L). Matches the 0.35 margin the existing
 * "Something changed" snapshot logic already assumes for a side business, so
 * the two stay consistent. Drives the QBI base and Solo-401(k) earnings base.
 */
export const ASSUMED_NET_PROFIT_MARGIN = 0.35;

/**
 * Combined (federal + state) marginal rate assumed only when the user's real
 * rate is missing from their snapshot. 24% is the federal bracket a typical
 * dual-income household lands in; results computed with this fallback are
 * flagged in their description as an estimate.
 */
export const FALLBACK_MARGINAL_RATE = 0.24;

/** Assumed number of children on payroll when the user says kids help but no
 *  dependents-under-18 count is on file. */
export const ASSUMED_CHILDREN_ON_PAYROLL = 1;

/** Re-export so the hire-children calc reads one name. */
export const PAYROLL_REVENUE_FRACTION = FAMILY_PAYROLL_REVENUE_FRACTION;

/** IRS simplified home-office method: $/sq ft and the sq-ft cap (Rev. Proc. 2013-13). */
export const HOME_OFFICE_SIMPLIFIED_RATE_PER_SQFT = 5;
export const HOME_OFFICE_SIMPLIFIED_SQFT_CAP = 300;

/** IRC §179 SUV/heavy-vehicle deduction cap for 2026, and the business-use floor. */
export const SECTION_179_VEHICLE_CAP = 30_500;
export const SECTION_179_BUSINESS_USE_FLOOR_PCT = 50;

// ─── S-Corp split (mirrors strategies/sCorpElection.ts) ──────────────────────

/** Fraction of S-Corp revenue taken as a reasonable W-2 salary (SE/FICA applies). */
export const SCORP_SALARY_FRACTION = 0.6;
/** Remainder taken as a distribution — exempt from the 15.3% SE tax. */
export const SCORP_DISTRIBUTION_FRACTION = 0.4;

// ─── Deadlines ──────────────────────────────────────────────────────────────

/** Month (0-indexed) and day for the IRS Form 2553 S-Corp election deadline. */
export const SCORP_ELECTION_DEADLINE = { month: 2, day: 15 } as const; // March 15

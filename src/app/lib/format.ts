/**
 * Single source of truth for formatting user-facing values.
 *
 * Why this exists: currency/percent/date formatting was copy-pasted as a local
 * `fmt()` into ~20 page components, each subtly different (rounding, compaction,
 * `Intl` options). Every user-facing number should read the same way across the
 * app, and a formatting change should happen in exactly one place. New code MUST
 * import from here rather than re-implementing.
 */

/** US locale is fixed for now — the app is US tax/personal-finance only. */
const LOCALE = 'en-US';

/**
 * Whole-dollar USD, e.g. `3520` → `"$3,520"`, `-480` → `"-$480"`.
 *
 * Non-finite input (NaN/Infinity, e.g. a divide-by-zero in a calc) formats as
 * `"$0"` so a broken number never renders as "NaN" on screen.
 */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${Math.abs(rounded).toLocaleString(LOCALE)}`;
}

/**
 * Compact USD for space-constrained UI (badges, chart axes, dense rows), e.g.
 * `3520` → `"$3.5k"`, `1_200_000` → `"$1.2M"`, `640` → `"$640"`.
 *
 * Values under $1,000 fall back to {@link formatCurrency} so small amounts stay exact.
 */
export function formatCurrencyCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '$0';
  const abs = Math.abs(amount);
  if (abs < 1_000) return formatCurrency(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs < 1_000_000) return `${sign}$${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

/**
 * Format a ratio as a percentage, e.g. `0.0325` → `"3.3%"`, `1` → `"100%"`.
 *
 * @param ratio        A 0–1 fraction (NOT a 0–100 number).
 * @param fractionDigits Decimal places to show. Default `0`.
 */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

/**
 * Parse a date input to a `Date`. A bare calendar date (`YYYY-MM-DD`, no time)
 * is interpreted in **local** time, not UTC, so a stored date like `"2026-08-31"`
 * never displays as the 30th in a negative-offset timezone.
 */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (bare) return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]));
  return new Date(value);
}

/**
 * Long, human date from an ISO string or `Date`, e.g. `"August 31, 2026"`.
 * Invalid input returns an em dash rather than `"Invalid Date"`.
 */
export function formatDate(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(LOCALE, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Short month/day from an ISO string or `Date`, e.g. `"Aug 31"` — for calendars
 * and compact list rows where the year is implied by context.
 * Invalid input returns an em dash.
 */
export function formatMonthDay(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
}

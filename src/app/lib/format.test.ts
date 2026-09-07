import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatDate,
  formatMonthDay,
} from './format';

describe('formatCurrency', () => {
  it('formats whole dollars with thousands separators', () => {
    expect(formatCurrency(3520)).toBe('$3,520');
    expect(formatCurrency(1_234_567)).toBe('$1,234,567');
  });

  it('rounds to the nearest dollar', () => {
    expect(formatCurrency(3520.49)).toBe('$3,520');
    expect(formatCurrency(3520.5)).toBe('$3,521');
  });

  it('handles zero and negatives', () => {
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(-480)).toBe('-$480');
  });

  it('falls back to "$0" for non-finite input', () => {
    expect(formatCurrency(Number.NaN)).toBe('$0');
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe('$0');
  });
});

describe('formatCurrencyCompact', () => {
  it('delegates to exact formatting under $1,000', () => {
    expect(formatCurrencyCompact(0)).toBe('$0');
    expect(formatCurrencyCompact(640)).toBe('$640');
    expect(formatCurrencyCompact(-200)).toBe('-$200');
  });

  it('compacts thousands', () => {
    expect(formatCurrencyCompact(3520)).toBe('$3.5k');
    expect(formatCurrencyCompact(12_000)).toBe('$12k');
    expect(formatCurrencyCompact(-1500)).toBe('-$1.5k');
  });

  it('compacts millions', () => {
    expect(formatCurrencyCompact(1_000_000)).toBe('$1M');
    expect(formatCurrencyCompact(1_200_000)).toBe('$1.2M');
  });

  it('falls back to "$0" for non-finite input', () => {
    expect(formatCurrencyCompact(Number.NaN)).toBe('$0');
  });
});

describe('formatPercent', () => {
  it('formats a 0–1 ratio, no decimals by default', () => {
    expect(formatPercent(0.0325)).toBe('3%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
  });

  it('honours the fractionDigits argument', () => {
    expect(formatPercent(0.0325, 1)).toBe('3.3%');
    expect(formatPercent(0.5, 2)).toBe('50.00%');
  });

  it('handles negatives and non-finite input', () => {
    expect(formatPercent(-0.1)).toBe('-10%');
    expect(formatPercent(Number.NaN)).toBe('0%');
  });
});

describe('formatDate', () => {
  it('formats a bare calendar date without a timezone shift', () => {
    expect(formatDate('2026-08-31')).toBe('August 31, 2026');
    expect(formatDate('2026-01-01')).toBe('January 1, 2026');
  });

  it('accepts a Date object', () => {
    expect(formatDate(new Date(2026, 7, 31))).toBe('August 31, 2026');
  });

  it('returns an em dash for invalid input', () => {
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('formatMonthDay', () => {
  it('formats month and day only', () => {
    expect(formatMonthDay('2026-08-31')).toBe('Aug 31');
    expect(formatMonthDay(new Date(2026, 0, 1))).toBe('Jan 1');
  });

  it('returns an em dash for invalid input', () => {
    expect(formatMonthDay('nope')).toBe('—');
  });
});

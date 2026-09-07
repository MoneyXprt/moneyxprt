/** Formats a whole-dollar debt amount for compact card display. */
export function formatDebtUsd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

/** Formats a paid-off date using the product's US English display convention. */
export function formatDebtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Calculates a clamped, whole-percent payoff progress value. */
export function getDebtPaidOffPercent(originalBalance: number, currentBalance: number): number {
  if (originalBalance <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((originalBalance - currentBalance) / originalBalance) * 100)));
}

/** Returns today in the ISO date format accepted by native date inputs. */
export function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

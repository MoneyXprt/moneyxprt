export const FINANCIAL_METRICS = [
  'net_worth', 'cash', 'total_debt', 'investments',
  'monthly_income', 'monthly_spend', 'passive_income',
] as const;

export type FinancialMetric = typeof FINANCIAL_METRICS[number];
export type ObservationSource = 'manual' | 'snapshot' | 'actual';

export interface FinancialObservationInput {
  metric: FinancialMetric;
  value: number;
  observedOn: string;
  source: ObservationSource;
  note?: string | null;
}

export interface FinancialObservation extends FinancialObservationInput {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** Validates and normalizes a financial observation before persistence. */
export function normalizeFinancialObservation(
  input: FinancialObservationInput,
): FinancialObservationInput {
  if (!FINANCIAL_METRICS.includes(input.metric)) throw new Error('Unknown financial metric.');
  if (!Number.isFinite(input.value) || Math.abs(input.value) > 1_000_000_000) {
    throw new Error('Observation value must be a reasonable finite number.');
  }
  if (!isIsoDate(input.observedOn)) throw new Error('Observation date must use YYYY-MM-DD.');
  if (!['manual', 'snapshot', 'actual'].includes(input.source)) throw new Error('Unknown observation source.');
  const note = input.note?.trim() || null;
  if (note && note.length > 500) throw new Error('Observation note must be 500 characters or fewer.');
  return { ...input, value: Math.round(input.value * 100) / 100, note };
}

/** Returns true for calendar-valid ISO date strings without accepting rollovers. */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

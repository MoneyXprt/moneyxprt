import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type {
  Section179TaxConstants,
  Section179TaxConstantsUnavailableReason,
  StrategyEvaluationContext,
} from './strategies/types';

export const TAX_CONSTANTS_LOAD_TIMEOUT_MS = 2_000;

export interface TaxConstantsByYearLoadResult extends StrategyEvaluationContext {
  section179TaxConstants: Section179TaxConstants | null;
  section179TaxConstantsUnavailableReason?: Section179TaxConstantsUnavailableReason;
}

interface TaxConstantsByYearRow {
  tax_year: number;
  section_179_heavy_vehicle_cap: number | string;
  section_179_max_deduction: number | string;
  section_179_phase_out_threshold: number | string;
  section_179_complete_phase_out: number | string;
}

/** Converts an immutable tax-constant database row into strategy evaluation input. */
function toSection179TaxConstants(row: TaxConstantsByYearRow): Section179TaxConstants {
  return {
    taxYear: row.tax_year,
    heavyVehicleCap: Number(row.section_179_heavy_vehicle_cap),
    maxDeduction: Number(row.section_179_max_deduction),
    phaseOutThreshold: Number(row.section_179_phase_out_threshold),
    completePhaseOut: Number(row.section_179_complete_phase_out),
  };
}

/**
 * Loads confirmed Section 179 constants for exactly one tax year.
 *
 * This lookup never throws: callers can render non-Section-179 content when the
 * row is missing, the network fails, or the bounded lookup times out.
 */
export async function loadTaxConstantsByYear(
  taxYear: number,
  client: SupabaseClient = getBrowserSupabaseClient(),
): Promise<TaxConstantsByYearLoadResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timed-out'>(resolve => {
    timeoutId = setTimeout(() => resolve('timed-out'), TAX_CONSTANTS_LOAD_TIMEOUT_MS);
  });
  try {
    const query = client
      .from('tax_constants_by_year')
      .select('tax_year,section_179_heavy_vehicle_cap,section_179_max_deduction,section_179_phase_out_threshold,section_179_complete_phase_out')
      .eq('tax_year', taxYear)
      .maybeSingle();
    const result = await Promise.race([query, timeout]);
    if (result === 'timed-out') return unavailable('timed-out');
    if (result.error) return unavailable('load-failed');
    return result.data
      ? { section179TaxConstants: toSection179TaxConstants(result.data as TaxConstantsByYearRow) }
      : unavailable('not-found');
  } catch {
    return unavailable('load-failed');
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Builds a typed unavailable result without exposing transport details to the UI. */
function unavailable(reason: Section179TaxConstantsUnavailableReason): TaxConstantsByYearLoadResult {
  return { section179TaxConstants: null, section179TaxConstantsUnavailableReason: reason };
}

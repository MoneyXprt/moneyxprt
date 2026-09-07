import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeFinancialObservation,
  type FinancialMetric,
  type FinancialObservation,
  type FinancialObservationInput,
} from './financialObservations';

interface ObservationRow {
  id: string;
  user_id: string;
  metric: FinancialMetric;
  value: number;
  observed_on: string;
  source: FinancialObservationInput['source'];
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Saves one daily observation, replacing the same metric/source recorded that day. */
export async function saveFinancialObservation(
  client: SupabaseClient,
  userId: string,
  input: FinancialObservationInput,
): Promise<FinancialObservation> {
  const observation = normalizeFinancialObservation(input);
  const { data, error } = await client
    .from('financial_observations')
    .upsert({
      user_id: userId,
      metric: observation.metric,
      value: observation.value,
      observed_on: observation.observedOn,
      source: observation.source,
      note: observation.note,
    }, { onConflict: 'user_id,metric,observed_on,source' })
    .select()
    .single();
  if (error) throw new Error(`Could not save financial observation: ${error.message}`);
  return fromRow(data as ObservationRow);
}

/** Lists a metric's observations from oldest to newest for chart-friendly use. */
export async function listFinancialObservations(
  client: SupabaseClient,
  userId: string,
  metric: FinancialMetric,
): Promise<FinancialObservation[]> {
  const { data, error } = await client
    .from('financial_observations')
    .select('*')
    .eq('user_id', userId)
    .eq('metric', metric)
    .order('observed_on');
  if (error) throw new Error(`Could not load financial observations: ${error.message}`);
  return (data as ObservationRow[] ?? []).map(fromRow);
}

/** Maps snake_case persistence fields to the app's camelCase contract. */
function fromRow(row: ObservationRow): FinancialObservation {
  return {
    id: row.id,
    userId: row.user_id,
    metric: row.metric,
    value: Number(row.value),
    observedOn: row.observed_on,
    source: row.source,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

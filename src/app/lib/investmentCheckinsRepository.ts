import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvestmentCheckIn } from './investmentPerformance';

interface CheckInRow { id: string; portfolio_value: number; cumulative_contributions: number; observed_on: string; }

/** Loads investment check-ins in chronological order for return calculations. */
export async function listInvestmentCheckIns(client: SupabaseClient, userId: string): Promise<InvestmentCheckIn[]> {
  const { data, error } = await client.from('investment_checkins').select('id, portfolio_value, cumulative_contributions, observed_on').eq('user_id', userId).order('observed_on');
  if (error) throw new Error(`Could not load investment check-ins: ${error.message}`);
  return ((data as CheckInRow[] | null) ?? []).map(row => ({ id: row.id, portfolioValue: Number(row.portfolio_value), cumulativeContributions: Number(row.cumulative_contributions), observedOn: row.observed_on }));
}

/** Saves a daily manual portfolio value and cumulative contribution total. */
export async function saveInvestmentCheckIn(client: SupabaseClient, userId: string, portfolioValue: number, cumulativeContributions: number, observedOn: string): Promise<void> {
  if (![portfolioValue, cumulativeContributions].every(value => Number.isFinite(value) && value >= 0 && value <= 1_000_000_000)) throw new Error('Amounts must be reasonable positive numbers.');
  const { error } = await client.from('investment_checkins').upsert({ user_id: userId, portfolio_value: portfolioValue, cumulative_contributions: cumulativeContributions, observed_on: observedOn }, { onConflict: 'user_id,observed_on' });
  if (error) throw new Error(`Could not save investment check-in: ${error.message}`);
}

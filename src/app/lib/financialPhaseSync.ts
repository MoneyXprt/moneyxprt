import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { computeFinancialPhase, type FinancialPhase } from './financialPhase';

type SupabaseClient = ReturnType<typeof getBrowserSupabaseClient>;

/**
 * Fetches what computeFinancialPhase needs — the latest snapshot's emergencyFund and
 * monthlySpend, and whether the user has any currently active debt — computes the
 * phase, and upserts it into financial_phase_status (single row per user, keyed on
 * user_id). Returns the computed phase, or null if there's no snapshot yet to compute
 * from (nothing written in that case — a default phase without any underlying data
 * would be misleading).
 *
 * Call this anywhere debt state or emergencyFund actually changes: after
 * recordDebtPayment (Actuals' apply-to-debt, the Debts page's log-a-payment), and
 * after an Audit form save.
 */
export async function syncFinancialPhase(sb: SupabaseClient, userId: string): Promise<FinancialPhase | null> {
  const [{ data: snapshotRow }, { count: activeDebtCount }] = await Promise.all([
    sb.from('financial_snapshots')
      .select('emergency_fund, monthly_spend')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true),
  ]);

  if (!snapshotRow) return null;

  const phase = computeFinancialPhase(
    {
      emergencyFund: Number(snapshotRow.emergency_fund ?? 0),
      monthlySpend:  Number(snapshotRow.monthly_spend ?? 0),
    },
    (activeDebtCount ?? 0) > 0,
  );

  const { error } = await sb
    .from('financial_phase_status')
    .upsert({ user_id: userId, phase }, { onConflict: 'user_id' });
  if (error) throw error;

  return phase;
}

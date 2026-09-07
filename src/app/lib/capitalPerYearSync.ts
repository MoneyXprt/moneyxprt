import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { fromRow, type SnapshotRow } from './snapshots';
import { computeAnnualDeployableTotal, type BonusPlan, type BonusPayment } from './deployableCapital';

type SupabaseClient = ReturnType<typeof getBrowserSupabaseClient>;

/**
 * Fetches the latest snapshot, bonus_plan, and bonus_payments_actual, computes
 * Math.round(computeAnnualDeployableTotal(...)) — the same formula phase2/page.tsx
 * uses — and upserts it into user_constraints.capital_per_year (single row per user,
 * keyed on user_id). Returns the computed value, or null if there's no snapshot yet
 * to compute from (nothing written in that case, same as syncFinancialPhase).
 *
 * capital_per_year previously only updated when the user manually revisited and
 * resubmitted phase2 — with no connection to snapshot changes made via Audit, it could
 * silently go stale relative to the live snapshot. Call this anywhere the snapshot
 * changes (Audit's handleSubmit), same as syncFinancialPhase/syncDebtsTracker.
 */
export async function syncCapitalPerYear(sb: SupabaseClient, userId: string): Promise<number | null> {
  const [{ data: snapshotRow }, { data: bonusPlanRow }, { data: bonusPaymentRows }] = await Promise.all([
    sb.from('financial_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('bonus_plan')
      .select('frequency, plan_amount, payment_month')
      .eq('user_id', userId)
      .maybeSingle(),
    sb.from('bonus_payments_actual')
      .select('amount, net_amount, deployable_amount, date_paid')
      .eq('user_id', userId),
  ]);

  if (!snapshotRow) return null;

  const snapshot = fromRow(snapshotRow as SnapshotRow);

  const bonusPlan: BonusPlan | null = bonusPlanRow ? {
    frequency:    bonusPlanRow.frequency as BonusPlan['frequency'],
    planAmount:   Number(bonusPlanRow.plan_amount),
    paymentMonth: bonusPlanRow.payment_month,
  } : null;

  const bonusPayments: BonusPayment[] = (bonusPaymentRows ?? []).map(r => ({
    amount:           Number(r.amount),
    datePaid:         new Date(r.date_paid),
    netAmount:        r.net_amount != null ? Number(r.net_amount) : undefined,
    deployableAmount: r.deployable_amount != null ? Number(r.deployable_amount) : undefined,
  }));

  const capitalPerYear = Math.round(computeAnnualDeployableTotal(snapshot, bonusPlan, bonusPayments));

  const { error } = await sb
    .from('user_constraints')
    .upsert({ user_id: userId, capital_per_year: capitalPerYear }, { onConflict: 'user_id' });
  if (error) throw error;

  return capitalPerYear;
}

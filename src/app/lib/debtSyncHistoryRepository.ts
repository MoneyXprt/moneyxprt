import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

/** Metadata Audit is permitted to synchronize to an existing tracked debt. */
export interface AuditDebtMetadata {
  name: string;
  interestRate: number;
  minimumPayment: number;
}

/** Synchronizes audited debt metadata through the database-backed history function. */
export async function syncAuditDebtMetadata(debtId: string, metadata: AuditDebtMetadata): Promise<void> {
  const { error } = await getBrowserSupabaseClient().rpc('sync_audit_debt_metadata', {
    target_debt_id: debtId,
    target_name: metadata.name,
    target_interest_rate: metadata.interestRate,
    target_minimum_payment: metadata.minimumPayment,
  });
  if (error) throw new Error(error.message);
}

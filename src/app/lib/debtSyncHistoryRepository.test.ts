import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('@/app/utils/supabaseClient', () => ({
  getBrowserSupabaseClient: () => ({ rpc }),
}));

import { syncAuditDebtMetadata } from './debtSyncHistoryRepository';

describe('Audit debt metadata synchronization', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it('routes name, rate, and payment changes through the audited metadata RPC', async () => {
    await syncAuditDebtMetadata('debt-id', {
      name: 'Pool Loan', interestRate: 7.25, minimumPayment: 450,
    });

    expect(rpc).toHaveBeenCalledWith('sync_audit_debt_metadata', {
      target_debt_id: 'debt-id', target_name: 'Pool Loan',
      target_interest_rate: 7.25, target_minimum_payment: 450,
    });
  });
});

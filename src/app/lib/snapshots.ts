import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { FinancialSnapshot } from '@/app/lib/strategies/types';

// ─── DB row type ─────────────────────────────────────────────────────────────
// Mirrors the financial_snapshots table columns exactly.
// Note: the `debts` array on FinancialSnapshot has no corresponding column in
// the table — it is intentionally excluded from persistence here.

interface SnapshotRow {
  id: string;
  user_id: string;
  snapshot_date: string;
  created_at: string;
  w2_income: number;
  bonus_income: number;
  income_1099: number;
  spouse_works: boolean;
  filing_status: string;
  state: string;
  dependents_under_18: number;
  has_business_entity: boolean;
  business_revenue: number;
  current_tax_paid: number;
  monthly_spend: number;
  emergency_fund: number;
  retirement_balance: number;
  home_equity: number;
  traditional_ira_balance: number;
  has_hsa_available: boolean;
  considering_real_estate: boolean;
  planned_property_value: number | null;
  reps_qualified: boolean | null;
  employer_401k_allows_after_tax: boolean | null;
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function toRow(
  userId: string,
  s: FinancialSnapshot,
): Omit<SnapshotRow, 'id' | 'snapshot_date' | 'created_at'> {
  return {
    user_id:                       userId,
    w2_income:                     s.w2Income,
    bonus_income:                  s.bonusIncome,
    income_1099:                   s.income1099,
    spouse_works:                  s.spouseWorks,
    filing_status:                 s.filingStatus,
    state:                         s.state,
    dependents_under_18:           s.dependentsUnder18,
    has_business_entity:           s.hasBusinessEntity,
    business_revenue:              s.businessRevenue,
    current_tax_paid:              s.currentTaxPaid,
    monthly_spend:                 s.monthlySpend,
    emergency_fund:                s.emergencyFund,
    retirement_balance:            s.retirementBalance,
    home_equity:                   s.homeEquity,
    traditional_ira_balance:       s.traditionalIraBalance,
    has_hsa_available:             s.hasHsaAvailable,
    considering_real_estate:       s.consideringRealEstate,
    planned_property_value:        s.plannedPropertyValue ?? null,
    reps_qualified:                s.repsQualified ?? null,
    employer_401k_allows_after_tax: s.employer401kAllowsAfterTax ?? null,
  };
}

function fromRow(row: SnapshotRow): FinancialSnapshot {
  return {
    w2Income:                    Number(row.w2_income),
    bonusIncome:                 Number(row.bonus_income),
    income1099:                  Number(row.income_1099),
    spouseWorks:                 row.spouse_works,
    filingStatus:                row.filing_status as 'single' | 'mfj',
    state:                       row.state,
    dependentsUnder18:           row.dependents_under_18,
    hasBusinessEntity:           row.has_business_entity,
    businessRevenue:             Number(row.business_revenue),
    currentTaxPaid:              Number(row.current_tax_paid),
    monthlySpend:                Number(row.monthly_spend),
    emergencyFund:               Number(row.emergency_fund),
    retirementBalance:           Number(row.retirement_balance),
    homeEquity:                  Number(row.home_equity),
    traditionalIraBalance:       Number(row.traditional_ira_balance),
    hasHsaAvailable:             row.has_hsa_available,
    consideringRealEstate:       row.considering_real_estate,
    plannedPropertyValue:        row.planned_property_value ?? undefined,
    repsQualified:               row.reps_qualified ?? undefined,
    employer401kAllowsAfterTax:  row.employer_401k_allows_after_tax ?? undefined,
    // debts not persisted — callers should merge in separately if needed
    debts: [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Insert a new snapshot row for the currently authenticated user.
 * Append-only — never updates an existing row, preserving full history.
 *
 * Returns the inserted row (id + created_at included) or throws on error.
 */
export async function saveSnapshot(
  snapshot: FinancialSnapshot,
): Promise<SnapshotRow> {
  const sb = getBrowserSupabaseClient();

  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated — sign in before saving a snapshot.');
  }

  const { data, error } = await sb
    .from('financial_snapshots')
    .insert(toRow(user.id, snapshot))
    .select()
    .single();

  if (error) throw new Error(`saveSnapshot failed: ${error.message}`);
  return data as SnapshotRow;
}

/**
 * Fetch the most recent snapshot for the currently authenticated user.
 * Returns a FinancialSnapshot (camelCase) or null if none exists yet.
 */
export async function getLatestSnapshot(): Promise<FinancialSnapshot | null> {
  const sb = getBrowserSupabaseClient();

  const { data: { user }, error: authError } = await sb.auth.getUser();
  if (authError || !user) {
    throw new Error('Not authenticated — sign in before loading a snapshot.');
  }

  const { data, error } = await sb
    .from('financial_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getLatestSnapshot failed: ${error.message}`);
  if (!data) return null;

  return fromRow(data as SnapshotRow);
}

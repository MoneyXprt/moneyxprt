import type { SupabaseClient } from '@supabase/supabase-js';
import type { SpouseBusinessSnapshotContext } from './spouseBusinessTypes';

interface SpouseBusinessSnapshotRow {
  id: string;
  spouse_business_revenue: number | null;
  filing_status: string | null;
  state: string | null;
  w2_income: number | null;
  bonus_income: number | null;
  spouse_w2_income: number | null;
  dependents_under_18: number | null;
  primary_residence_value: number | null;
  home_office_square_footage: number | null;
  vehicle_purchase_price: number | null;
  vehicle_business_use_percent: number | null;
}

const SNAPSHOT_FIELDS = [
  'id',
  'spouse_business_revenue',
  'filing_status',
  'state',
  'w2_income',
  'bonus_income',
  'spouse_w2_income',
  'dependents_under_18',
  'primary_residence_value',
  'home_office_square_footage',
  'vehicle_purchase_price',
  'vehicle_business_use_percent',
].join(',');

/** Load and normalize the latest snapshot values needed by the guided flow. */
export async function getSpouseBusinessSnapshotContext(
  client: SupabaseClient,
  userId: string,
): Promise<SpouseBusinessSnapshotContext | null> {
  const { data, error } = await client
    .from('financial_snapshots')
    .select(SNAPSHOT_FIELDS)
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not load your latest financial snapshot: ${error.message}`);
  if (!data) return null;

  const row = data as unknown as SpouseBusinessSnapshotRow;
  return {
    snapshotId: row.id,
    annualRevenue: Number(row.spouse_business_revenue ?? 0),
    filingStatus: row.filing_status === 'single' ? 'single' : 'mfj',
    state: row.state ?? 'CA',
    householdIncome:
      Number(row.w2_income ?? 0) +
      Number(row.bonus_income ?? 0) +
      Number(row.spouse_w2_income ?? 0),
    dependentsUnder18: Number(row.dependents_under_18 ?? 0),
    ownsHome: Number(row.primary_residence_value ?? 0) > 0,
    homeOfficeSquareFootage: Number(row.home_office_square_footage ?? 0),
    vehiclePurchaseAmount: Number(row.vehicle_purchase_price ?? 0),
    vehicleBusinessUsePercent: Number(row.vehicle_business_use_percent ?? 0),
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Section179EquipmentAssetInput } from './strategies/section179Shared';

export const SECTION_179_EQUIPMENT_DESCRIPTION_MIN_LENGTH = 2;
export const SECTION_179_EQUIPMENT_DESCRIPTION_MAX_LENGTH = 200;
export const SECTION_179_EQUIPMENT_MAX_PURCHASE_PRICE = 1_000_000_000;
export const SECTION_179_EQUIPMENT_MAX_BUSINESS_USE_PERCENT = 100;

export interface Section179EquipmentRecord extends Section179EquipmentAssetInput {
  id: string;
  userId: string;
  createdAt: string;
}

export type NewSection179EquipmentRecord = Section179EquipmentAssetInput;

interface EquipmentDatabaseRow {
  id: string;
  user_id: string;
  description: string;
  purchase_price: number | string;
  placed_in_service_date: string;
  business_use_percent: number | string;
  created_at: string;
}

/** Converts an equipment database row into the typed record used by the app. */
function toEquipmentRecord(row: EquipmentDatabaseRow): Section179EquipmentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    description: row.description,
    purchasePrice: Number(row.purchase_price),
    placedInServiceDate: row.placed_in_service_date,
    businessUsePercent: Number(row.business_use_percent),
    createdAt: row.created_at,
  };
}

/** Validates an equipment record before it is persisted. */
export function validateSection179EquipmentRecord(input: NewSection179EquipmentRecord): string | null {
  const descriptionLength = input.description.trim().length;
  if (descriptionLength < SECTION_179_EQUIPMENT_DESCRIPTION_MIN_LENGTH || descriptionLength > SECTION_179_EQUIPMENT_DESCRIPTION_MAX_LENGTH) return 'Enter an equipment description between 2 and 200 characters.';
  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice <= 0 || input.purchasePrice > SECTION_179_EQUIPMENT_MAX_PURCHASE_PRICE) return 'Enter a valid purchase price.';
  if (!Number.isFinite(input.businessUsePercent) || input.businessUsePercent <= 0 || input.businessUsePercent > SECTION_179_EQUIPMENT_MAX_BUSINESS_USE_PERCENT) return 'Enter a business-use percentage from 1 to 100.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.placedInServiceDate)) return 'Enter a valid placed-in-service date.';
  return null;
}

/** Lists a user's Section 179 equipment records by placed-in-service date. */
export async function listSection179EquipmentRecords(
  userId: string,
  client: SupabaseClient = getBrowserSupabaseClient(),
): Promise<Section179EquipmentRecord[]> {
  const { data, error } = await client.from('section_179_equipment')
    .select('id,user_id,description,purchase_price,placed_in_service_date,business_use_percent,created_at')
    .eq('user_id', userId).order('placed_in_service_date', { ascending: false });
  if (error) throw new Error(`Could not load equipment: ${error.message}`);
  return ((data as EquipmentDatabaseRow[] | null) ?? []).map(toEquipmentRecord);
}

/** Adds one owner-scoped equipment asset for the current Section 179 tax year. */
export async function addSection179EquipmentRecord(
  userId: string,
  input: NewSection179EquipmentRecord,
): Promise<Section179EquipmentRecord> {
  const validationError = validateSection179EquipmentRecord(input);
  if (validationError) throw new Error(validationError);
  const { data, error } = await getBrowserSupabaseClient().from('section_179_equipment')
    .insert({ user_id: userId, description: input.description.trim(), purchase_price: input.purchasePrice, placed_in_service_date: input.placedInServiceDate, business_use_percent: input.businessUsePercent })
    .select('id,user_id,description,purchase_price,placed_in_service_date,business_use_percent,created_at').single();
  if (error) throw new Error(`Could not add equipment: ${error.message}`);
  return toEquipmentRecord(data as EquipmentDatabaseRow);
}

/** Deletes one owner-scoped equipment record. */
export async function deleteSection179EquipmentRecord(userId: string, equipmentId: string): Promise<void> {
  const { error } = await getBrowserSupabaseClient().from('section_179_equipment')
    .delete().eq('id', equipmentId).eq('user_id', userId);
  if (error) throw new Error(`Could not remove equipment: ${error.message}`);
}

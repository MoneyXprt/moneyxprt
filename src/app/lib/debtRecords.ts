import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

export const DEBT_CORRECTION_MIN_REASON_LENGTH = 10;
export const DEBT_CORRECTION_MAX_REASON_LENGTH = 1_000;
export const DEBT_CORRECTION_MAX_BALANCE = 1_000_000_000;

export interface DebtRecord {
  id: string;
  name: string;
  debtType: string;
  originalBalance: number;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  isActive: boolean;
  payoffOrder: number | null;
  paidOffAt: string | null;
}

export interface DebtCorrectionChanges {
  currentBalance: number;
  isActive: boolean;
}

interface DebtDatabaseRow {
  id: string;
  name: string;
  debt_type: string;
  original_balance: number | string;
  current_balance: number | string;
  interest_rate: number | string;
  minimum_payment: number | string;
  is_active: boolean;
  payoff_order: number | null;
  paid_off_at: string | null;
}

/** Converts a database debt row into the app's typed debt record. */
function toDebtRecord(row: DebtDatabaseRow): DebtRecord {
  return {
    id: row.id,
    name: row.name,
    debtType: row.debt_type,
    originalBalance: Number(row.original_balance),
    currentBalance: Number(row.current_balance),
    interestRate: Number(row.interest_rate),
    minimumPayment: Number(row.minimum_payment),
    isActive: row.is_active,
    payoffOrder: row.payoff_order,
    paidOffAt: row.paid_off_at,
  };
}

/** Returns a user-owned debt list, separated by active state for the UI. */
export async function listDebtRecords(userId: string): Promise<{ active: DebtRecord[]; paidOff: DebtRecord[] }> {
  const client = getBrowserSupabaseClient();
  const { data, error } = await client
    .from('debts')
    .select('id,name,debt_type,original_balance,current_balance,interest_rate,minimum_payment,is_active,payoff_order,paid_off_at')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('payoff_order', { ascending: true, nullsFirst: false })
    .order('paid_off_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);

  const records = ((data as DebtDatabaseRow[] | null) ?? []).map(toDebtRecord);
  return { active: records.filter(record => record.isActive), paidOff: records.filter(record => !record.isActive) };
}

/** Validates inputs that are permitted in an audit-logged debt correction. */
export function validateDebtCorrection(changes: DebtCorrectionChanges, reason: string): string | null {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < DEBT_CORRECTION_MIN_REASON_LENGTH) {
    return `Reason must be at least ${DEBT_CORRECTION_MIN_REASON_LENGTH} characters.`;
  }
  if (trimmedReason.length > DEBT_CORRECTION_MAX_REASON_LENGTH) {
    return `Reason must be ${DEBT_CORRECTION_MAX_REASON_LENGTH} characters or fewer.`;
  }
  if (!Number.isFinite(changes.currentBalance) || changes.currentBalance < 0 || changes.currentBalance > DEBT_CORRECTION_MAX_BALANCE) {
    return 'Enter a valid current balance.';
  }
  if (changes.isActive && changes.currentBalance === 0) {
    return 'An active debt must have a balance greater than $0.';
  }
  if (!changes.isActive && changes.currentBalance !== 0) {
    return 'A paid-off debt must have a current balance of $0.';
  }
  return null;
}

/** Corrects limited debt fields through the atomic, audit-logged database function. */
export async function correctDebtRecord(
  debtId: string,
  changes: DebtCorrectionChanges,
  reason: string,
): Promise<DebtRecord> {
  const validationError = validateDebtCorrection(changes, reason);
  if (validationError) throw new Error(validationError);

  const { data, error } = await getBrowserSupabaseClient().rpc('correct_debt_record', {
    target_debt_id: debtId,
    target_current_balance: changes.currentBalance,
    target_is_active: changes.isActive,
    correction_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The debt correction did not return an updated record.');
  return toDebtRecord(data as DebtDatabaseRow);
}

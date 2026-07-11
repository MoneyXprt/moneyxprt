import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import { computeDebtPayoffOrder } from './debtPayoff';

type SupabaseClient = ReturnType<typeof getBrowserSupabaseClient>;

export interface PaidOffInfo {
  paidOffName: string;
  freedMinimumPayment: number;
  nextDebtName: string | null;
}

export interface RecordDebtPaymentParams {
  userId: string;
  debtId: string;
  amount: number;
  paymentDate: string; // 'YYYY-MM-DD'
  source: 'regular' | 'lump_sum';
  note?: string | null;
}

export interface RecordDebtPaymentResult {
  newBalance: number;
  paidOff: boolean;
  paidOffInfo: PaidOffInfo | null;
}

/**
 * Records a payment against a specific debt: inserts the debt_payments row, subtracts
 * from current_balance (clamped at 0), and — if that zeroes the balance — marks the
 * debt inactive, sets paid_off_at, re-ranks all remaining debts (snowball default),
 * and returns info for a "paid off" celebration message.
 *
 * freedMinimumPayment/paidOffInfo are display-only — not wired into any
 * deployable-capital calculation.
 *
 * Shared by Actuals' "Apply bonus to debt" (source: 'lump_sum', targets the
 * top-ranked debt automatically) and the debts page's "Log a payment" (source:
 * 'regular', targets whichever debt the user picks) — both need the exact same
 * zero-balance/re-rank handling, so it lives here once instead of being duplicated.
 */
export async function recordDebtPayment(
  sb: SupabaseClient,
  params: RecordDebtPaymentParams,
): Promise<RecordDebtPaymentResult> {
  const { userId, debtId, amount, paymentDate, source, note } = params;

  const { data: debt, error: debtError } = await sb
    .from('debts')
    .select('id, name, current_balance, minimum_payment')
    .eq('id', debtId)
    .single();
  if (debtError) throw debtError;

  const newBalance = Math.max(0, Number(debt.current_balance) - amount);
  const paidOff    = newBalance === 0;

  const { error: paymentError } = await sb.from('debt_payments').insert({
    debt_id:      debtId,
    user_id:      userId,
    amount,
    payment_date: paymentDate,
    source,
    note: note ?? null,
  });
  if (paymentError) throw paymentError;

  const { error: updateDebtError } = await sb
    .from('debts')
    .update({
      current_balance: newBalance,
      ...(paidOff ? { is_active: false, paid_off_at: new Date().toISOString() } : {}),
    })
    .eq('id', debtId);
  if (updateDebtError) throw updateDebtError;

  const paidOffInfo = paidOff
    ? await reRankAfterPayoff(sb, userId, debt.name, Number(debt.minimum_payment))
    : null;

  return { newBalance, paidOff, paidOffInfo };
}

async function reRankAfterPayoff(
  sb: SupabaseClient,
  userId: string,
  paidOffName: string,
  freedMinimumPayment: number,
): Promise<PaidOffInfo> {
  const { data: allDebts } = await sb
    .from('debts')
    .select('id, current_balance, interest_rate, is_active')
    .eq('user_id', userId);

  const ranked = computeDebtPayoffOrder(
    (allDebts ?? []).map(d => ({
      id: d.id,
      currentBalance: Number(d.current_balance),
      interestRate: Number(d.interest_rate),
      isActive: d.is_active,
    })),
    'snowball',
  );

  await Promise.all(
    ranked.map(r => sb.from('debts').update({ payoff_order: r.payoffOrder }).eq('id', r.id)),
  );

  const nextEntry = ranked.find(r => r.payoffOrder === 1);
  let nextDebtName: string | null = null;
  if (nextEntry) {
    const { data: nextDebtRow } = await sb.from('debts').select('name').eq('id', nextEntry.id).maybeSingle();
    nextDebtName = nextDebtRow?.name ?? null;
  }

  return { paidOffName, freedMinimumPayment, nextDebtName };
}

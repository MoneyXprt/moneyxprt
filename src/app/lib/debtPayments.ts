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

// ─── Cascading (multi-debt) payment ────────────────────────────────────────

export interface DebtAffected {
  debtId: string;
  debtName: string;
  amountApplied: number;
  paidOff: boolean;
}

export interface CascadingPaymentResult {
  /** Sum of amountApplied across debtsAffected — equals amount minus remainderUnapplied. */
  totalApplied: number;
  /** > 0 only if every active debt got fully paid off before the amount was exhausted. */
  remainderUnapplied: number;
  /** One entry per debt actually touched, in the order payments were applied. */
  debtsAffected: DebtAffected[];
  /** One entry per debt that was fully paid off during this call, in payoff order. */
  paidOffInfos: PaidOffInfo[];
}

export interface RecordCascadingDebtPaymentParams {
  userId: string;
  /** Debt to start applying against — the caller's chosen top-ranked debt. */
  startDebtId: string;
  amount: number;
  paymentDate: string; // 'YYYY-MM-DD'
  source: 'regular' | 'lump_sum';
  note?: string | null;
}

/**
 * Applies a payment that may exceed the starting debt's balance, cascading the
 * remainder into subsequently-ranked active debts until either the full amount is
 * allocated or no active debts remain. Built on recordDebtPayment as its per-debt
 * primitive — each debt actually paid against gets its own debt_payments row (one
 * recordDebtPayment call per debt), never a single row for the whole lump sum, so
 * payment history accurately reflects where the money went.
 *
 * Deliberately separate from recordDebtPayment itself, which debts/page.tsx's manual
 * "Log a payment" (handleLogPayment) keeps using unmodified — there, the user picks a
 * specific debt on purpose, and an overpayment should not silently roll into a
 * different, un-selected debt. This function is only for Actuals' "Apply bonus to
 * debt," which always targets the top-ranked debt and is exactly the flow a real lump
 * sum can exceed.
 */
export async function recordCascadingDebtPayment(
  sb: SupabaseClient,
  params: RecordCascadingDebtPaymentParams,
): Promise<CascadingPaymentResult> {
  const { userId, amount, paymentDate, source, note, startDebtId } = params;

  let remaining = amount;
  let currentDebtId: string | null = startDebtId;
  const debtsAffected: DebtAffected[] = [];
  const paidOffInfos: PaidOffInfo[] = [];

  while (remaining > 0 && currentDebtId) {
    const { data: debt, error: debtError } = await sb
      .from('debts')
      .select('id, name, current_balance')
      .eq('id', currentDebtId)
      .single();
    if (debtError) throw debtError;

    const balance = Number(debt.current_balance);
    // Defensive guard — the loop only ever advances to a debt just confirmed active
    // with a positive balance (either the caller's startDebtId or a freshly re-ranked
    // top debt), so this shouldn't trigger in practice.
    if (balance <= 0) break;

    const amountForThisDebt = Math.min(remaining, balance);

    const { paidOff, paidOffInfo } = await recordDebtPayment(sb, {
      userId,
      debtId: currentDebtId,
      amount: amountForThisDebt,
      paymentDate,
      source,
      note,
    });

    debtsAffected.push({
      debtId: currentDebtId,
      debtName: debt.name,
      amountApplied: amountForThisDebt,
      paidOff,
    });
    remaining -= amountForThisDebt;

    if (!paidOff || !paidOffInfo) {
      // amountForThisDebt < balance, i.e. amountForThisDebt === remaining (the min()
      // branch that took remaining) — the payment was fully consumed on this debt with
      // balance left over on it. Nothing left to cascade. (recordDebtPayment guarantees
      // paidOffInfo is non-null whenever paidOff is true, but this is money-handling
      // code — checking both explicitly instead of asserting it.)
      currentDebtId = null;
      continue;
    }

    paidOffInfos.push(paidOffInfo);

    if (remaining <= 0) {
      currentDebtId = null;
      continue;
    }

    // recordDebtPayment already re-ranked remaining active debts (via
    // reRankAfterPayoff) — fetch whichever one is now top-ranked to continue.
    const { data: nextTop } = await sb
      .from('debts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('payoff_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    currentDebtId = nextTop?.id ?? null;
  }

  return {
    totalApplied: amount - remaining,
    remainderUnapplied: remaining,
    debtsAffected,
    paidOffInfos,
  };
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

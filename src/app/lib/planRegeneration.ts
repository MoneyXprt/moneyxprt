/**
 * planRegeneration.ts
 *
 * Shared "recompute the plan and its actions from saved data, then persist both"
 * pipeline — the same generateBaselinePlan + savePlan + generateActions + saveActions
 * sequence plan/results/page.tsx runs for its own account on every visit, extracted so
 * it can also be triggered on a different account's behalf (see
 * /api/regenerate-partner-plan/route.ts, used by a partner's explicit "refresh" action).
 * Takes an explicit Supabase client so it works with either a browser session (self) or
 * a service-role client (server route acting on someone else's account after its own
 * authorization check).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateBaselinePlan, savePlan, type PlanInputs } from './planGenerator';
import { generateActions, saveActions } from './actionGenerator';
import { getSnapshotForServer } from './snapshots';
import type { FinancialPhase } from './financialPhase';
import type { SimulatableDebt } from './debtPayoff';
import type { BonusPlan } from './deployableCapital';

export async function regeneratePlanAndActions(sb: SupabaseClient, userId: string): Promise<void> {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd   = `${currentYear + 1}-01-01`;

  const [
    { data: profileRow },
    { data: assetRows },
    { data: constraintsRow },
    { data: bonusPlanRow },
    { data: phaseRow },
    { data: debtRows },
    { data: repsRows },
  ] = await Promise.all([
    sb.from('freedom_profiles')
      .select('vision_text, target_free_age, freedom_type, freedom_number_monthly, portfolio_target, housing, health_insurance, food, transportation, travel, kids, savings_buffer, misc')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('asset_preferences').select('asset_type').eq('user_id', userId).eq('selected', true),
    sb.from('user_constraints').select('capital_per_year, hours_per_week, risk_tolerance, hard_constraints').eq('user_id', userId).maybeSingle(),
    sb.from('bonus_plan').select('frequency, plan_amount, payment_month').eq('user_id', userId).maybeSingle(),
    sb.from('financial_phase_status').select('phase').eq('user_id', userId).maybeSingle(),
    sb.from('debts').select('id, name, current_balance, interest_rate, is_active').eq('user_id', userId).eq('is_active', true),
    sb.from('material_participation_logs').select('hours_logged')
      .eq('user_id', userId)
      .gte('date', yearStart)
      .lt('date', yearEnd),
  ]);

  const snapshot = await getSnapshotForServer(userId, sb);
  if (!profileRow || !snapshot || !constraintsRow) {
    throw new Error('Missing plan prerequisites (profile, snapshot, or constraints) for this account.');
  }

  const financialPhase = (phaseRow?.phase as FinancialPhase | undefined) ?? null;
  const debts: SimulatableDebt[] = (debtRows ?? []).map(d => ({
    id:             d.id,
    name:           d.name,
    currentBalance: Number(d.current_balance),
    interestRate:   Number(d.interest_rate),
    isActive:       d.is_active,
  }));
  const bonusPlan: BonusPlan | null = bonusPlanRow ? {
    frequency:    bonusPlanRow.frequency as BonusPlan['frequency'],
    planAmount:   Number(bonusPlanRow.plan_amount),
    paymentMonth: bonusPlanRow.payment_month,
  } : null;
  const repsHoursThisYear = (repsRows ?? []).reduce((s, r) => s + Number(r.hours_logged ?? 0), 0);

  const inputs: PlanInputs = {
    freedomProfile: {
      visionText:    profileRow.vision_text ?? null,
      targetFreeAge: Number(profileRow.target_free_age),
      freedomType:   profileRow.freedom_type as 'never_work' | 'work_optional' | 'lower_stress',
    },
    freedomNumber: {
      monthlyTarget:   Number(profileRow.freedom_number_monthly),
      portfolioTarget: Number(profileRow.portfolio_target),
      breakdown: {
        housing:           Number(profileRow.housing ?? 0),
        health_insurance:  Number(profileRow.health_insurance ?? 0),
        food:              Number(profileRow.food ?? 0),
        transportation:    Number(profileRow.transportation ?? 0),
        travel:            Number(profileRow.travel ?? 0),
        kids:              Number(profileRow.kids ?? 0),
        savings_buffer:    Number(profileRow.savings_buffer ?? 0),
        misc:              Number(profileRow.misc ?? 0),
      },
    },
    snapshot,
    assetPreferences: (assetRows ?? []).map(r => r.asset_type as string),
    constraints: {
      capitalPerYear:  Number(constraintsRow.capital_per_year),
      hoursPerWeek:    Number(constraintsRow.hours_per_week),
      riskTolerance:   constraintsRow.risk_tolerance as string,
      hardConstraints: (constraintsRow.hard_constraints as string[]) ?? [],
    },
    financialPhase,
    debts,
  };

  const generated = generateBaselinePlan(inputs);
  await savePlan(generated, userId, sb);
  const execActions = generateActions(generated, snapshot, repsHoursThisYear, bonusPlan, financialPhase);
  await saveActions(execActions, userId, sb);
}

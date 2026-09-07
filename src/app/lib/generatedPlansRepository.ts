import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedPlan } from './planGenerator';

interface GeneratedPlanIdRow {
  id: string;
}

export type GeneratedPlanPromotionCaller = 'user-session' | 'service-role';

/** Persists a plan history row, then atomically promotes it to the user's current plan. */
export async function saveGeneratedPlan(
  client: SupabaseClient,
  userId: string,
  plan: GeneratedPlan,
  caller: GeneratedPlanPromotionCaller,
): Promise<string> {
  const projectedFreedomDate = plan.freedomGap.projectedFreedomYear > 0
    ? `${plan.freedomGap.projectedFreedomYear}-01-01`
    : null;
  const { data, error } = await client
    .from('generated_plans')
    .insert({
      user_id: userId,
      is_current: false,
      freedom_gap: plan.freedomGap,
      phases: plan.phases,
      tax_strategy_stack: plan.taxStrategyStack,
      asset_roadmap: plan.assetRoadmap,
      deployable_capital_per_year: plan.deployableCapitalPerYear,
      ai_narrative: null,
      projected_freedom_date: projectedFreedomDate,
    })
    .select('id')
    .single();
  if (error) throw new Error(`saveGeneratedPlan failed: ${error.message}`);

  const insertedPlan = data as GeneratedPlanIdRow | null;
  if (!insertedPlan?.id) throw new Error('saveGeneratedPlan did not return a plan id.');

  const { data: currentPlanId, error: promotionError } = await client.rpc(
    caller === 'service-role'
      ? 'make_generated_plan_current_as_service_role'
      : 'make_generated_plan_current',
    { target_plan_id: insertedPlan.id },
  );
  if (promotionError) throw new Error(`saveGeneratedPlan promotion failed: ${promotionError.message}`);
  if (currentPlanId !== insertedPlan.id) throw new Error('The generated plan was not promoted to current.');
  return insertedPlan.id;
}

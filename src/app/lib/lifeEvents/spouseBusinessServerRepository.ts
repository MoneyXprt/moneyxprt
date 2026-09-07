import type { SupabaseClient } from '@supabase/supabase-js';
import { regeneratePlanAndActions } from '@/app/lib/planRegeneration';
import {
  evaluateSpouseBusinessStrategies,
  type SpouseBusinessExpenseCategory,
  type FamilyInvolvement,
} from '@/app/lib/calculations/spouseBusiness';
import { ASSUMED_NET_PROFIT_MARGIN } from '@/app/lib/calculations/spouseBusinessConstants';
import { buildSpouseBusinessInputs, MONTHS_PER_YEAR } from './spouseBusinessModel';
import { getSpouseBusinessSnapshotContext } from './spouseBusinessRepository';
import type { AddSpouseBusinessPlanRequest } from './spouseBusinessTypes';

const LIFE_EVENT_STRATEGY_PREFIX = 'life-event:spouse-business:';
const MAX_MONTHLY_REVENUE = 1_000_000_000;
const MAX_SELECTED_STRATEGIES = 4;

interface ExecutionActionInsert {
  user_id: string;
  title: string;
  description: string;
  category: 'this_week' | 'this_quarter' | 'this_year';
  phase: number;
  strategy_id: string;
  estimated_annual_value: number;
  estimated_months_saved: number;
  completed: boolean;
  completed_at: null;
  due_date: string | null;
  sort_order: number;
}

/** Convert selected recommendations into typed execution-action rows. */
function buildActionRows(
  userId: string,
  request: AddSpouseBusinessPlanRequest,
  context: NonNullable<Awaited<ReturnType<typeof getSpouseBusinessSnapshotContext>>>,
): ExecutionActionInsert[] {
  const inputs = buildSpouseBusinessInputs(
    {
      hasSales: request.monthlyRevenue > 0,
      monthlyRevenue: request.monthlyRevenue,
      expenseCategories: request.expenseCategories,
      familyInvolvement: request.familyInvolvement,
    },
    context,
  );
  const selectedIds = new Set(request.strategyIds);
  const eligibleStrategies = evaluateSpouseBusinessStrategies(inputs);
  const eligibleIds = new Set(eligibleStrategies.map((strategy) => strategy.id));
  if ([...selectedIds].some((id) => !eligibleIds.has(id))) {
    throw new Error('Choose recommendations shown in your business plan.');
  }
  return eligibleStrategies
    .filter((strategy) => selectedIds.has(strategy.id))
    .map((strategy, index) => ({
      user_id: userId,
      title: strategy.name,
      description: strategy.unlocked ? strategy.description : strategy.unlockCondition,
      category: strategy.deadline ? 'this_quarter' : 'this_year',
      phase: 1,
      strategy_id: `${LIFE_EVENT_STRATEGY_PREFIX}${strategy.id}`,
      estimated_annual_value: strategy.annualSavings,
      estimated_months_saved: 0,
      completed: false,
      completed_at: null,
      due_date: strategy.deadline?.toISOString().slice(0, 10) ?? null,
      sort_order: index,
    }));
}

/** Persist selected actions, update the snapshot, and regenerate the plan. */
export async function addSpouseBusinessStrategiesToPlan(
  client: SupabaseClient,
  userId: string,
  request: AddSpouseBusinessPlanRequest,
): Promise<void> {
  const context = await getSpouseBusinessSnapshotContext(client, userId);
  if (!context) throw new Error('Complete your financial snapshot before updating your plan.');

  const annualRevenue = request.monthlyRevenue * MONTHS_PER_YEAR;
  const actionRows = buildActionRows(userId, request, context);
  if (actionRows.length === 0) throw new Error('Choose at least one strategy to add to your plan.');

  const { error: clearError } = await client
    .from('execution_actions')
    .delete()
    .eq('user_id', userId)
    .like('strategy_id', `${LIFE_EVENT_STRATEGY_PREFIX}%`);
  if (clearError) throw new Error(`Could not refresh your business actions: ${clearError.message}`);

  const { error: insertError } = await client.from('execution_actions').insert(actionRows);
  if (insertError) throw new Error(`Could not add the business actions: ${insertError.message}`);

  const { error: snapshotError } = await client
    .from('financial_snapshots')
    .update({
      spouse_business_revenue: annualRevenue,
      spouse_business_net_profit: annualRevenue * ASSUMED_NET_PROFIT_MARGIN,
      snapshot_date: new Date().toISOString(),
    })
    .eq('id', context.snapshotId)
    .eq('user_id', userId);
  if (snapshotError) throw new Error(`Could not update business revenue: ${snapshotError.message}`);

  await regeneratePlanAndActions(client, userId, 'service-role');
}

/** Runtime validation for the public API boundary. */
export function isAddSpouseBusinessPlanRequest(
  value: unknown,
): value is AddSpouseBusinessPlanRequest {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const expenses: readonly SpouseBusinessExpenseCategory[] = [
    'equipment', 'home_office', 'vehicle', 'supplies', 'phone_internet', 'other',
  ];
  const involvement: readonly FamilyInvolvement[] = ['spouse_only', 'kids_help', 'others_help'];
  return (
    typeof input.monthlyRevenue === 'number' &&
    Number.isFinite(input.monthlyRevenue) &&
    input.monthlyRevenue >= 0 &&
    input.monthlyRevenue <= MAX_MONTHLY_REVENUE &&
    Array.isArray(input.strategyIds) &&
    input.strategyIds.length > 0 &&
    input.strategyIds.length <= MAX_SELECTED_STRATEGIES &&
    input.strategyIds.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 100) &&
    new Set(input.strategyIds).size === input.strategyIds.length &&
    Array.isArray(input.expenseCategories) &&
    input.expenseCategories.every((id) => expenses.includes(id)) &&
    new Set(input.expenseCategories).size === input.expenseCategories.length &&
    involvement.includes(input.familyInvolvement as FamilyInvolvement)
  );
}

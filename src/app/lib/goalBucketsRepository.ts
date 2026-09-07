import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeGoalBucket, type GoalBucket, type GoalBucketInput } from './goalBuckets';

interface GoalBucketRow {
  id: string;
  user_id: string;
  name: string;
  category: GoalBucket['category'];
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

/** Lists the current user's buckets in newest-first creation order. */
export async function listGoalBuckets(client: SupabaseClient, userId: string): Promise<GoalBucket[]> {
  const { data, error } = await client.from('goal_buckets').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load goal buckets: ${error.message}`);
  return ((data as GoalBucketRow[] | null) ?? []).map(fromRow);
}

/** Creates a user-owned bucket with its initial funded amount. */
export async function createGoalBucket(client: SupabaseClient, userId: string, input: GoalBucketInput): Promise<GoalBucket> {
  const bucket = normalizeGoalBucket(input);
  const { data, error } = await client.from('goal_buckets').insert({
    user_id: userId, name: bucket.name, category: bucket.category, target_amount: bucket.targetAmount,
    current_amount: bucket.currentAmount, target_date: bucket.targetDate,
  }).select().single();
  if (error) throw new Error(`Could not create goal bucket: ${error.message}`);
  return fromRow(data as GoalBucketRow);
}

/** Adjusts one bucket's funded amount while keeping its target unchanged. */
export async function updateGoalBucketAmount(client: SupabaseClient, bucket: GoalBucket, currentAmount: number): Promise<GoalBucket> {
  const normalized = normalizeGoalBucket({ ...bucket, currentAmount });
  const { data, error } = await client.from('goal_buckets').update({ current_amount: normalized.currentAmount }).eq('id', bucket.id).select().single();
  if (error) throw new Error(`Could not update goal bucket: ${error.message}`);
  return fromRow(data as GoalBucketRow);
}

/** Deletes one user-owned goal bucket. The database RLS policy limits this to its owner. */
export async function deleteGoalBucket(client: SupabaseClient, bucketId: string): Promise<void> {
  const { error } = await client.from('goal_buckets').delete().eq('id', bucketId);
  if (error) throw new Error(`Could not delete goal bucket: ${error.message}`);
}

function fromRow(row: GoalBucketRow): GoalBucket {
  return {
    id: row.id, userId: row.user_id, name: row.name, category: row.category,
    targetAmount: Number(row.target_amount), currentAmount: Number(row.current_amount), targetDate: row.target_date,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

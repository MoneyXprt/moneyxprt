import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import { checkRateLimit, type RateLimitPolicy, type RateLimitResult } from './rateLimit';

interface PersistentRateLimitRow {
  allowed: boolean;
  retry_after_seconds: number;
}

export interface ServerRateLimitResult extends RateLimitResult {
  source: 'persistent' | 'fallback';
}

/** Consumes a shared database limit, with a local fallback for local development. */
export async function checkServerRateLimit(
  key: string,
  policy: RateLimitPolicy,
): Promise<ServerRateLimitResult> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('consume_api_rate_limit', {
      p_key: key,
      p_max_requests: policy.maxRequests,
      p_window_seconds: Math.ceil(policy.windowMs / 1_000),
    });
    if (error) throw new Error(error.message);
    const row = (data as PersistentRateLimitRow[] | null)?.[0];
    if (!row) throw new Error('Rate-limit function returned no result.');
    return {
      allowed: row.allowed,
      retryAfterSeconds: row.retry_after_seconds,
      source: 'persistent',
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error;
    const local = checkRateLimit(key, policy);
    return { ...local, source: 'fallback' };
  }
}

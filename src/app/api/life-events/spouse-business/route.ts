import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import {
  addSpouseBusinessStrategiesToPlan,
  isAddSpouseBusinessPlanRequest,
} from '@/app/lib/lifeEvents/spouseBusinessServerRepository';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';

export const dynamic = 'force-dynamic';

/** Add spouse-business recommendations to the signed-in user's plan. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data, error: authError } = await authClient.auth.getUser(token);
    if (authError || !data.user) {
      return NextResponse.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 });
    }
    const limit = await checkServerRateLimit(
      `life-event-spouse-business:${data.user.id}`,
      { maxRequests: 10, windowMs: 60 * 60 * 1_000 },
    );
    if (!limit.allowed) return NextResponse.json(
      { error: 'Too many plan updates. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );

    const body: unknown = await request.json().catch(() => null);
    if (!isAddSpouseBusinessPlanRequest(body)) {
      return NextResponse.json({ error: 'Some business answers are missing or invalid.' }, { status: 400 });
    }

    await addSpouseBusinessStrategiesToPlan(
      createServerSupabaseClient(),
      data.user.id,
      body,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[spouse-business-life-event]', error);
    return NextResponse.json({ error: 'Could not update your plan. Please try again.' }, { status: 500 });
  }
}

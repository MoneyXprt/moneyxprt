import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import { regeneratePlanAndActions } from '@/app/lib/planRegeneration';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';

export const dynamic = 'force-dynamic';

// Lets an accepted partner explicitly trigger a fresh plan + execution_actions
// regeneration for the PRIMARY user's account — never automatic just from viewing the
// shared plan (see plan/results/page.tsx's partner-view branch, which only reads).
// Runs with the service-role key (bypasses RLS), since the partner's own RLS grants are
// read-only on generated_plans plus update-only on execution_actions — nowhere near
// enough to run savePlan/saveActions. The authorization check below replicates
// supabase/migrations/20260626000001_partner_access.sql's own partner-link condition
// explicitly, since that's the only thing enforcing the boundary once RLS is bypassed.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limit = await checkServerRateLimit(
      `regenerate-partner-plan:${user.id}`,
      { maxRequests: 10, windowMs: 60 * 60 * 1_000 },
    );
    if (!limit.allowed) return NextResponse.json(
      { error: 'Too many plan regenerations. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );

    const body = await req.json().catch(() => null) as { primaryUserId?: string } | null;
    const primaryUserId = body?.primaryUserId;
    if (!primaryUserId) {
      return NextResponse.json({ error: 'Missing primaryUserId' }, { status: 400 });
    }

    const sb = createServerSupabaseClient();

    const { data: link } = await sb
      .from('freedom_profiles')
      .select('user_id')
      .eq('user_id', primaryUserId)
      .eq('partner_user_id', user.id)
      .eq('partner_accepted', true)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: 'Not an accepted partner on this account.' }, { status: 403 });
    }

    await regeneratePlanAndActions(sb, primaryUserId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[regenerate-partner-plan]', err);
    return NextResponse.json({ error: 'Could not regenerate the plan. Please try again.' }, { status: 500 });
  }
}

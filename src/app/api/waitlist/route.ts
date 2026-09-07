import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';
import { normalizeWaitlistEmail } from '@/app/lib/waitlist';

export const dynamic = 'force-dynamic';

function requestKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

/** Accept a validated, rate-limited public waitlist request. */
export async function POST(request: NextRequest) {
  const limit = await checkServerRateLimit(`waitlist:${requestKey(request)}`, {
    maxRequests: 5,
    windowMs: 60 * 60 * 1_000,
  });
  if (!limit.allowed) return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
  );

  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  const email = normalizeWaitlistEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const { error } = await createServerSupabaseClient().from('waitlist').insert({ email });
  if (error && error.code !== '23505') {
    console.error('[waitlist]', error);
    return NextResponse.json({ error: 'Could not join the waitlist. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

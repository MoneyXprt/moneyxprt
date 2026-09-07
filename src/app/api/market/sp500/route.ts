import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';

export const dynamic = 'force-dynamic';

interface FredObservation { date: string; value: string; }
interface FredResponse { observations?: FredObservation[]; }

/** Returns FRED SP500 closes nearest to the requested comparison dates. */
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user } } = await authClient.auth.getUser(token.slice(7));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limit = await checkServerRateLimit(`market-sp500:${user.id}`, { maxRequests: 30, windowMs: 60 * 60 * 1_000 });
  if (!limit.allowed) return NextResponse.json(
    { error: 'Too many benchmark requests. Try again later.' },
    { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
  );
  const start = request.nextUrl.searchParams.get('start');
  const end = request.nextUrl.searchParams.get('end');
  const key = process.env.FRED_API_KEY;
  if (!key) return NextResponse.json({ error: 'Benchmark data is not configured.' }, { status: 503 });
  if (!isDate(start) || !isDate(end) || start > end) return NextResponse.json({ error: 'Use valid start and end dates.' }, { status: 400 });
  const params = new URLSearchParams({ series_id: 'SP500', api_key: key, file_type: 'json', observation_start: start, observation_end: end, sort_order: 'asc' });
  try {
    const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?${params}`, { next: { revalidate: 3_600 } });
    if (!response.ok) throw new Error(`FRED returned ${response.status}`);
    const body = await response.json() as FredResponse;
    const observations = (body.observations ?? []).filter(row => Number.isFinite(Number(row.value)));
    if (observations.length < 2) return NextResponse.json({ error: 'No benchmark closes are available for that period.' }, { status: 422 });
    return NextResponse.json({ start: Number(observations[0].value), end: Number(observations.at(-1)!.value), source: 'FRED SP500 daily close' });
  } catch { return NextResponse.json({ error: 'Could not load benchmark data.' }, { status: 502 }); }
}

function isDate(value: string | null): value is string { return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)); }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/app/utils/supabaseClient';
import { checkServerRateLimit } from '@/app/lib/api/rateLimitServer';

export const dynamic = 'force-dynamic';

/** Mask an email address for the capability-link preview. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'your invited email';
  return `${local.slice(0, 1)}${'•'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}

/** Return only the metadata required to render an invitation link. */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const { data, error } = await createServerSupabaseClient()
    .from('partner_invitations')
    .select('accepted, invitee_email')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });

  return NextResponse.json({ accepted: data.accepted, inviteeEmail: maskEmail(data.invitee_email) });
}

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.replace('Bearer ', '');
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Verify the caller's session
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }
  const limit = await checkServerRateLimit(
    `accept-invitation:${user.id}`,
    { maxRequests: 10, windowMs: 60 * 60 * 1_000 },
  );
  if (!limit.allowed) return NextResponse.json(
    { error: 'Too many invitation attempts. Try again later.' },
    { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
  );

  const sessionClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
  const { data: inviterUserId, error: acceptanceError } = await sessionClient.rpc(
    'accept_partner_invitation', { invitation_token: token },
  );
  if (acceptanceError || !inviterUserId) {
    console.error('[accept-invitation]', acceptanceError);
    return NextResponse.json({ error: 'Could not accept this invitation. Check the invited email and try again.' }, { status: 400 });
  }

  return NextResponse.json({ success: true, inviterUserId });
}

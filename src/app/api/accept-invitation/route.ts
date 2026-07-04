import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/utils/supabaseClient';

export const dynamic = 'force-dynamic';

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

  const sb = createServerSupabaseClient();

  // Verify the caller's session
  const { data: { user }, error: userError } = await sb.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Look up the invitation by token (service role bypasses RLS)
  const { data: invitation, error: invError } = await sb
    .from('partner_invitations')
    .select('id, inviter_user_id, invitee_email, accepted')
    .eq('token', token)
    .single();

  if (invError || !invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  if (invitation.accepted) {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
  }

  if (invitation.inviter_user_id === user.id) {
    return NextResponse.json({ error: 'You cannot accept your own invitation' }, { status: 400 });
  }

  // Mark invitation accepted
  await sb
    .from('partner_invitations')
    .update({ accepted: true })
    .eq('id', invitation.id);

  // Update ALL of the inviter's freedom_profiles rows so the partner relationship
  // is visible regardless of which plan row is queried
  await sb
    .from('freedom_profiles')
    .update({ partner_user_id: user.id, partner_accepted: true })
    .eq('user_id', invitation.inviter_user_id);

  return NextResponse.json({ success: true, inviterUserId: invitation.inviter_user_id });
}

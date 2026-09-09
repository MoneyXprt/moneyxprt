'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import FeedbackForm from '@/components/FeedbackForm';

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PartnerStatus = 'loading' | 'none' | 'pending' | 'connected' | 'is_partner';

type PendingInvite = { id: string; token: string; invitee_email: string };

// ─── Partner section ────────────────────────────────────────────────────────
// Module scope rather than defined inside
// SettingsPage's body — a function declared inside a component's render body is
// re-created on every render, so React sees a new component type on every keystroke
// into the invite-email input and remounts the whole subtree, dropping focus.

interface PartnerSectionProps {
  partnerStatus: PartnerStatus;
  connectedEmail: string;
  removingPartner: boolean;
  removePartner: () => Promise<void>;
  pendingInvite: PendingInvite | null;
  inviteLink: string;
  cancellingInvite: boolean;
  cancelInvite: () => Promise<void>;
  sendInvite: (e: React.FormEvent) => Promise<void>;
  inviteInput: string;
  setInviteInput: (v: string) => void;
  inviteError: string;
  inviteSubmitting: boolean;
}

function PartnerSection({
  partnerStatus, connectedEmail, removingPartner, removePartner,
  pendingInvite, inviteLink, cancellingInvite, cancelInvite,
  sendInvite, inviteInput, setInviteInput, inviteError, inviteSubmitting,
}: PartnerSectionProps) {
  if (partnerStatus === 'loading') {
    return (
      <Section title="Your Freedom Partner">
        <div className="px-5 py-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Section>
    );
  }

  if (partnerStatus === 'is_partner') {
    return (
      <Section title="Your Freedom Partner">
        <div className="px-5 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Connected to a shared plan</p>
              <p className="text-xs text-gray-400">You can see your household&apos;s freedom plan and check off your actions.</p>
            </div>
          </div>
        </div>
      </Section>
    );
  }

  if (partnerStatus === 'connected') {
    return (
      <Section title="Your Freedom Partner">
        <div className="px-5 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Connected with {connectedEmail}</p>
              <p className="text-xs text-gray-400 mt-0.5">Your partner can see your freedom plan and check off their actions.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={removePartner}
            disabled={removingPartner}
            className="text-xs font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-50"
          >
            {removingPartner ? 'Removing…' : 'Remove partner access'}
          </button>
        </div>
      </Section>
    );
  }

  if (partnerStatus === 'pending' && pendingInvite) {
    return (
      <Section title="Your Freedom Partner">
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Invitation pending</p>
              <p className="text-xs text-gray-500 mt-0.5">{pendingInvite.invitee_email}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Share this link with your partner:</p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              <p className="text-xs text-gray-600 break-all flex-1 font-mono">{inviteLink}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(inviteLink)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 shrink-0 transition"
              >
                Copy
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={cancelInvite}
            disabled={cancellingInvite}
            className="text-xs font-semibold text-red-500 hover:text-red-700 transition disabled:opacity-50"
          >
            {cancellingInvite ? 'Cancelling…' : 'Cancel invitation'}
          </button>
        </div>
      </Section>
    );
  }

  // partnerStatus === 'none'
  return (
    <Section title="Your Freedom Partner">
      <div className="px-5 py-5">
        <p className="text-sm text-gray-500 mb-4">
          Invite your spouse or partner to see your shared freedom plan.
        </p>
        <form onSubmit={sendInvite} className="space-y-3">
          <div>
            <input
              type="email"
              placeholder="Partner's email address"
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            {inviteError && <p className="text-xs text-red-500 mt-1.5">{inviteError}</p>}
          </div>
          <button
            type="submit"
            disabled={inviteSubmitting}
            className="w-full py-2.5 rounded-xl bg-[#1B3A2D] text-white text-sm font-semibold hover:bg-emerald-900 transition disabled:opacity-60"
          >
            {inviteSubmitting ? 'Sending…' : 'Send invitation'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">Free for partners. They&apos;ll get a link to join your shared plan.</p>
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession]             = useState<Session | null>(null);
  const [pageLoading, setPageLoading]     = useState(true);

  // Partner state
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>('loading');
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [connectedEmail, setConnectedEmail] = useState('');
  const [inviteInput, setInviteInput]     = useState('');
  const [inviteError, setInviteError]     = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [removingPartner, setRemovingPartner] = useState(false);
  const [inviteLink, setInviteLink]       = useState('');

  // Plan actions
  const [rebuilding, setRebuilding]       = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // ── Auth + data load ───────────────────────────────────────────────────────

  const loadPartnerData = useCallback(async (userId: string) => {
    const sb = getBrowserSupabaseClient();

    // Check if we sent an invite
    const { data: sentInvite } = await sb
      .from('partner_invitations')
      .select('id, token, invitee_email, accepted')
      .eq('inviter_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sentInvite) {
      if (sentInvite.accepted) {
        setConnectedEmail(sentInvite.invitee_email);
        setPartnerStatus('connected');
      } else {
        setPendingInvite({ id: sentInvite.id, token: sentInvite.token, invitee_email: sentInvite.invitee_email });
        setInviteLink(`${window.location.origin}/invite/${sentInvite.token}`);
        setPartnerStatus('pending');
      }
      return;
    }

    // Check if someone else has this user as their partner (we are the partner)
    const { data: partnerProfile } = await sb
      .from('freedom_profiles')
      .select('user_id')
      .eq('partner_user_id', userId)
      .eq('partner_accepted', true)
      .maybeSingle();

    if (partnerProfile) {
      setPartnerStatus('is_partner');
      return;
    }

    setPartnerStatus('none');
  }, []);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setPageLoading(false);
      if (s) loadPartnerData(s.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [loadPartnerData]);

  // ── Partner actions ────────────────────────────────────────────────────────

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    const email = inviteInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setInviteError('Enter a valid email address.');
      return;
    }
    if (!session) return;
    setInviteSubmitting(true);

    const sb = getBrowserSupabaseClient();
    const { data, error } = await sb
      .from('partner_invitations')
      .insert({ inviter_user_id: session.user.id, invitee_email: email })
      .select('id, token, invitee_email')
      .single();

    if (error || !data) {
      setInviteError('Failed to create invitation. Please try again.');
      setInviteSubmitting(false);
      return;
    }

    const link = `${window.location.origin}/invite/${data.token}`;
    setInviteLink(link);
    setPendingInvite({ id: data.id, token: data.token, invitee_email: data.invitee_email });
    setPartnerStatus('pending');
    setInviteSubmitting(false);
  }

  async function cancelInvite() {
    if (!pendingInvite || !session) return;
    setCancellingInvite(true);
    const sb = getBrowserSupabaseClient();
    await sb.from('partner_invitations').delete().eq('id', pendingInvite.id);
    // Clear partner_email on all profile rows
    await sb.from('freedom_profiles').update({ partner_email: null }).eq('user_id', session.user.id);
    setPendingInvite(null);
    setInviteLink('');
    setInviteInput('');
    setPartnerStatus('none');
    setCancellingInvite(false);
  }

  async function removePartner() {
    if (!session) return;
    setRemovingPartner(true);
    const sb = getBrowserSupabaseClient();

    // Find the invitation to delete
    const { data: inv } = await sb
      .from('partner_invitations')
      .select('id')
      .eq('inviter_user_id', session.user.id)
      .eq('accepted', true)
      .maybeSingle();
    if (inv) await sb.from('partner_invitations').delete().eq('id', inv.id);

    // Clear partner columns on all profile rows
    await sb
      .from('freedom_profiles')
      .update({ partner_user_id: null, partner_accepted: false, partner_email: null })
      .eq('user_id', session.user.id);

    setConnectedEmail('');
    setPartnerStatus('none');
    setRemovingPartner(false);
  }

  // ── Plan actions ───────────────────────────────────────────────────────────

  async function rebuildPlan() {
    const confirmed = window.confirm(
      'This will clear your plan, strategies, and all preferences so you can start fresh. Your financial snapshot history is preserved. Continue?'
    );
    if (!confirmed || !session) return;

    setRebuilding(true);
    setError(null);
    const { error: resetError } = await getBrowserSupabaseClient().rpc('reset_my_plan');
    if (resetError) {
      console.error('[rebuild-plan]', resetError);
      setError('Could not reset your plan. Please try again.');
      setRebuilding(false);
      return;
    }
    router.push('/dashboard/freedom-vision');
  }

  async function exportMyData() {
    if (!session) return;
    setExporting(true);
    setError(null);
    const sb = getBrowserSupabaseClient();
    const tables = [
      'freedom_profiles', 'financial_snapshots', 'financial_observations',
      'generated_plans', 'execution_actions', 'asset_preferences',
      'user_constraints', 'plan_assumptions', 'financial_phase_status',
      'goal_buckets', 'investment_checkins', 'cash_flow_events',
      'debts', 'debt_payments', 'bonus_plan', 'bonus_payments_actual',
      'material_participation_logs', 'partner_invitations',
      'product_feedback',
    ];
    try {
      const results = await Promise.all(tables.map(async (table) => {
        const { data, error: exportError } = await sb.from(table).select('*').eq('user_id', session.user.id);
        // Keep exports available while an older deployment is awaiting the
        // feedback-table migration; every other table remains required.
        if (exportError && table === 'product_feedback' && ['42P01', 'PGRST205'].includes(exportError.code ?? '')) {
          return [table, []] as const;
        }
        if (exportError) throw new Error(`Could not export ${table}.`);
        return [table, data] as const;
      }));
      const archive = {
        exportedAt: new Date().toISOString(),
        accountEmail: session.user.email,
        data: Object.fromEntries(results),
      };
      const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `moneyxprt-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error('[data-export]', exportError);
      setError('Could not export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Sign in to view your settings.</p>
          <Link href="/dashboard" className="text-emerald-600 font-semibold hover:underline">← Dashboard</Link>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">Account Settings</p>
          <button
            onClick={() => getBrowserSupabaseClient().auth.signOut()}
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-5">

        {/* Account info */}
        <div className="bg-[#1B3A2D] rounded-2xl px-5 py-4 text-white">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Signed in as</p>
          <p className="text-sm font-semibold">{session.user.email}</p>
        </div>

        {/* Partner section */}
        <PartnerSection
          partnerStatus={partnerStatus}
          connectedEmail={connectedEmail}
          removingPartner={removingPartner}
          removePartner={removePartner}
          pendingInvite={pendingInvite}
          inviteLink={inviteLink}
          cancellingInvite={cancellingInvite}
          cancelInvite={cancelInvite}
          sendInvite={sendInvite}
          inviteInput={inviteInput}
          setInviteInput={setInviteInput}
          inviteError={inviteError}
          inviteSubmitting={inviteSubmitting}
        />

        {/* Your Plan */}
        <Section title="Your Plan">
          <div className="px-5 py-4 space-y-3">
            <button
              type="button"
              onClick={rebuildPlan}
              disabled={rebuilding}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {rebuilding && (
                <span className="inline-block w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              )}
              {rebuilding ? 'Resetting plan…' : 'Regenerate my plan'}
            </button>
            {error && (
              <p className="text-xs text-red-500 leading-snug">{error}</p>
            )}
            <Link
              href="/dashboard/cpa-report"
              className="block w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold text-center hover:bg-gray-50 transition"
            >
              Generate CPA year-end report (PDF)
            </Link>
            <Link
              href="/dashboard/asset-preferences"
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Edit asset preferences
            </Link>
          </div>
        </Section>

        <Section title="Your data">
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm leading-5 text-gray-600">Download a JSON copy of the information you have saved in MoneyXprt. Keep the file private: it includes your financial details.</p>
            <button
              type="button"
              onClick={exportMyData}
              disabled={exporting}
              className="w-full min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? 'Preparing export…' : 'Download my data'}
            </button>
          </div>
        </Section>

        <Section title="Feedback">
          <FeedbackForm userId={session.user.id} />
        </Section>

        <div className="pb-4">
          <Link href="/dashboard" className="flex items-center justify-center text-sm text-gray-400 hover:text-gray-700 transition py-2 gap-1">
            ← Back to dashboard
          </Link>
        </div>

      </main>
    </div>
  );
}

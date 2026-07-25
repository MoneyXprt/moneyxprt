'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        on ? 'bg-emerald-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

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

function Row({ label, sublabel, right }: { label: string; sublabel?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm text-gray-900">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PartnerStatus = 'loading' | 'none' | 'pending' | 'connected' | 'is_partner';

type PendingInvite = { id: string; token: string; invitee_email: string };

// ─── Partner section ────────────────────────────────────────────────────────
// Module scope (like Toggle/Section/Row above) rather than defined inside
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
              <p className="text-xs text-gray-400">You can see your household's freedom plan and check off your actions.</p>
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

interface NotificationPrefs {
  weeklyCheckin: boolean;
  milestones: boolean;
  taxDeadlines: boolean;
  monthlyProgress: boolean;
}

const NOTIF_KEY = 'mxprt_notif_prefs';

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession]             = useState<Session | null>(null);
  const [pageLoading, setPageLoading]     = useState(true);

  // Partner state
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>('loading');
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [connectedEmail, setConnectedEmail] = useState('');
  const [inviterEmail, setInviterEmail]   = useState(''); // when this user is the partner
  const [inviteInput, setInviteInput]     = useState('');
  const [inviteError, setInviteError]     = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [removingPartner, setRemovingPartner] = useState(false);
  const [inviteLink, setInviteLink]       = useState('');

  // Notifications (localStorage only — no backend yet)
  const [notifs, setNotifs] = useState<NotificationPrefs>({
    weeklyCheckin: true,
    milestones: true,
    taxDeadlines: true,
    monthlyProgress: true,
  });

  // Plan actions
  const [rebuilding, setRebuilding]       = useState(false);
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
      // Try to find the inviter's email from partner_invitations
      const { data: inv } = await sb
        .from('partner_invitations')
        .select('invitee_email')
        .eq('inviter_user_id', partnerProfile.user_id)
        .eq('accepted', true)
        .maybeSingle();
      setInviterEmail(inv?.invitee_email ?? ''); // invitee_email is OUR email
      setPartnerStatus('is_partner');
      return;
    }

    setPartnerStatus('none');
  }, []);

  useEffect(() => {
    // Load notifications from localStorage
    try {
      const stored = localStorage.getItem(NOTIF_KEY);
      if (stored) setNotifs(JSON.parse(stored));
    } catch { /* ignore */ }

    const sb = getBrowserSupabaseClient();
    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setPageLoading(false);
      if (s) loadPartnerData(s.user.id);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [loadPartnerData]);

  function updateNotif(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...notifs, [key]: value };
    setNotifs(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  }

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
    const sb = getBrowserSupabaseClient();
    const uid = session.user.id;

    const steps: Array<{ table: string; label: string }> = [
      { table: 'execution_actions', label: 'execution actions' },
      { table: 'generated_plans',   label: 'generated plans' },
      { table: 'asset_preferences', label: 'asset preferences' },
      { table: 'user_constraints',  label: 'constraints' },
      { table: 'plan_assumptions',  label: 'plan assumptions' },
      { table: 'freedom_profiles',  label: 'freedom profile' },
    ];

    for (const step of steps) {
      const { error: deleteError } = await sb.from(step.table).delete().eq('user_id', uid);
      if (deleteError) {
        setError(`Failed to clear ${step.label}: ${deleteError.message}`);
        setRebuilding(false);
        return;
      }
    }

    sessionStorage.setItem('mxprt_fresh_audit', '1');
    router.push('/dashboard/freedom-vision?fresh=true');
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

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">

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

        {/* Notifications */}
        <Section title="Notifications">
          <Row
            label="Weekly plan check-in"
            sublabel="Remind me to review my progress each week"
            right={<Toggle on={notifs.weeklyCheckin} onChange={v => updateNotif('weeklyCheckin', v)} />}
          />
          <Row
            label="Freedom date milestones"
            sublabel="Alert when my freedom date moves"
            right={<Toggle on={notifs.milestones} onChange={v => updateNotif('milestones', v)} />}
          />
          <Row
            label="Tax strategy deadlines"
            sublabel="Remind me before year-end tax cutoffs"
            right={<Toggle on={notifs.taxDeadlines} onChange={v => updateNotif('taxDeadlines', v)} />}
          />
          <Row
            label="Monthly progress summary"
            sublabel="Freedom Score, strategies activated, and freedom date — sent on the 1st of each month"
            right={<Toggle on={notifs.monthlyProgress} onChange={v => updateNotif('monthlyProgress', v)} />}
          />
        </Section>

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
              {rebuilding ? 'Clearing plan data…' : 'Rebuild my plan from scratch'}
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
          </div>
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

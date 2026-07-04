'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';
import type { Session } from '@supabase/supabase-js';

type PageState = 'loading' | 'valid' | 'already_accepted' | 'invalid' | 'accepting' | 'success' | 'error';

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [session, setSession]     = useState<Session | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);

  useEffect(() => {
    const sb = getBrowserSupabaseClient();

    sb.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      lookupInvitation();
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookupInvitation() {
    const sb = getBrowserSupabaseClient();
    const { data, error } = await sb
      .from('partner_invitations')
      .select('accepted, invitee_email')
      .eq('token', token)
      .single();

    if (error || !data) {
      setPageState('invalid');
      return;
    }

    setInviteeEmail(data.invitee_email);
    setPageState(data.accepted ? 'already_accepted' : 'valid');
  }

  async function handleAccept() {
    if (!session) return;
    setPageState('accepting');
    try {
      const res = await fetch('/api/accept-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErrorMsg(body.error ?? 'Could not accept invitation.');
        setPageState('error');
        return;
      }
      setPageState('success');
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPageState('error');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-8 h-8 rounded-lg bg-[#1B3A2D] flex items-center justify-center">
          <svg className="w-4.5 h-4.5 text-white w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" />
          </svg>
        </div>
        <span className="font-bold text-gray-900">MoneyXprt</span>
      </div>

      <div className="w-full max-w-sm">
        {pageState === 'loading' && (
          <div className="flex justify-center">
            <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {pageState === 'invalid' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
            <p className="text-2xl mb-3">🔗</p>
            <h1 className="text-base font-bold text-gray-900 mb-2">Link not found</h1>
            <p className="text-sm text-gray-500 mb-6">
              This invitation link is invalid or has expired. Ask your partner to send a new one.
            </p>
            <Link href="/dashboard" className="text-sm text-emerald-600 font-semibold hover:underline">
              Go to MoneyXprt →
            </Link>
          </div>
        )}

        {pageState === 'already_accepted' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
            <p className="text-2xl mb-3">✅</p>
            <h1 className="text-base font-bold text-gray-900 mb-2">Already connected</h1>
            <p className="text-sm text-gray-500 mb-6">
              This invitation has already been accepted.
            </p>
            <Link href="/dashboard" className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition px-5 py-2.5 rounded-xl inline-block">
              Open dashboard →
            </Link>
          </div>
        )}

        {pageState === 'valid' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8">
            <p className="text-3xl mb-4 text-center">🏠</p>
            <h1 className="text-lg font-bold text-gray-900 mb-2 text-center">
              You&apos;ve been invited to a shared freedom plan
            </h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Join MoneyXprt to see your household&apos;s path to financial freedom, track shared actions, and check off your progress together.
            </p>

            {session ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 text-center">
                  Signed in as <span className="font-medium text-gray-600">{session.user.email}</span>
                </p>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="w-full py-3 rounded-xl bg-[#1B3A2D] text-white font-semibold text-sm hover:bg-emerald-900 transition"
                >
                  Accept invitation
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 text-center">
                  Create a free account to join{inviteeEmail ? ` (invited as ${inviteeEmail})` : ''}.
                </p>
                <Link
                  href={`/ask?invite=${token}`}
                  className="flex items-center justify-center w-full py-3 rounded-xl bg-[#1B3A2D] text-white font-semibold text-sm hover:bg-emerald-900 transition"
                >
                  Create your free account →
                </Link>
                <p className="text-xs text-center text-gray-400">
                  Already have an account?{' '}
                  <Link href={`/ask?invite=${token}&mode=signin`} className="text-emerald-600 font-semibold hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </div>
        )}

        {pageState === 'accepting' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center">
            <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Connecting your accounts…</p>
          </div>
        )}

        {pageState === 'success' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
            <p className="text-3xl mb-3">🎯</p>
            <h1 className="text-base font-bold text-gray-900 mb-2">You&apos;re connected!</h1>
            <p className="text-sm text-gray-500 mb-2">
              You now have access to your shared freedom plan.
            </p>
            <p className="text-xs text-gray-400">Redirecting to your dashboard…</p>
          </div>
        )}

        {pageState === 'error' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
            <p className="text-2xl mb-3">⚠️</p>
            <h1 className="text-base font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-red-600 mb-6">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setPageState('valid')}
              className="text-sm text-emerald-600 font-semibold hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

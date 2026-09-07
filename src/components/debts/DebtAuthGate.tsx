'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

interface DebtAuthGateProps { onSession: (session: Session) => void; }

/** Provides a passwordless sign-in gate for the standalone debts screen. */
export function DebtAuthGate({ onSession }: DebtAuthGateProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sends a one-click email sign-in link back to this screen. */
  const sendMagicLink = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await getBrowserSupabaseClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/dashboard/debts` } });
    setBusy(false);
    if (authError) setError(authError.message); else setSent(true);
  };

  useEffect(() => {
    const { data: { subscription } } = getBrowserSupabaseClient().auth.onAuthStateChange((_event, session) => { if (session) onSession(session); });
    return () => subscription.unsubscribe();
  }, [onSession]);

  return <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4"><div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"><h1 className="text-xl font-semibold text-gray-900">Sign in to continue</h1><p className="mb-6 mt-1 text-sm text-gray-500">We&apos;ll send a one-click sign-in link.</p>{sent ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4"><p className="text-sm font-medium text-emerald-700">Check your email</p><p className="mt-0.5 text-sm text-emerald-600">Link sent to <strong>{email}</strong></p></div> : <form onSubmit={sendMagicLink} className="space-y-3"><input type="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 px-3.5 text-sm" />{error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}<button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-emerald-600 text-sm font-medium text-white disabled:opacity-60">{busy ? 'Sending…' : 'Send magic link'}</button></form>}</div></div>;
}

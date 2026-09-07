'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

export type AuthStatus = 'loading' | 'authed' | 'anon';

/**
 * Shared client-side auth gate for dashboard screens.
 *
 * Every page in the app re-implements this same `getSession()` +
 * `onAuthStateChange()` dance inline; new Life Events screens use this hook
 * instead so the loading/authed/anon states are consistent and defined in one
 * place.
 *
 * @returns `session` (null until known) and `status`:
 *   - `loading` — still resolving the initial session
 *   - `authed`  — a valid session exists
 *   - `anon`    — resolved, no session (caller should show a sign-in prompt)
 */
export function useAuthSession(): { session: Session | null; status: AuthStatus } {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const sb = getBrowserSupabaseClient();
    let active = true;

    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setStatus(data.session ? 'authed' : 'anon');
      })
      .catch(() => {
        if (active) setStatus('anon');
      });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setStatus(next ? 'authed' : 'anon');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, status };
}

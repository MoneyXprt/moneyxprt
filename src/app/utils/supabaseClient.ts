import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  return key;
}

/**
 * Browser/client-component Supabase client — lazy singleton.
 * Uses the public anon key — safe to expose in the browser.
 * Import this in Client Components ("use client" files).
 */
let _browserClient: SupabaseClient | null = null;
export function getBrowserSupabaseClient(): SupabaseClient {
  if (!_browserClient) {
    _browserClient = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return _browserClient;
}

/**
 * Convenience re-export for existing code that does `import { supabase }`.
 * Calling this property getter at module-import time is fine because the value
 * is only resolved on first use, not at module-load time.
 *
 * NOTE: only use in browser / "use client" contexts.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getBrowserSupabaseClient()[prop as keyof SupabaseClient];
  },
});

/**
 * Server-side Supabase client with the service-role key.
 * NEVER import this in Client Components or expose it to the browser.
 * Use only in API routes and Server Actions.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function insertEmailToWaitlist(email: string) {
  const client = getBrowserSupabaseClient();
  const { data, error } = await client
    .from('waitlist')
    .insert([{ email }]);

  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }

  return data;
}
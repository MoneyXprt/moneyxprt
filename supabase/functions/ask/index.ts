/**
 * Retired legacy endpoint.
 *
 * Waitlist signups now use the Next.js /api/waitlist route, which validates input
 * and applies a shared rate limit before using the server-side Supabase client.
 * Keep this deployed response non-mutating to close the previous public write path.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(() => new Response(JSON.stringify({ error: 'This endpoint has been retired.' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json' },
}));

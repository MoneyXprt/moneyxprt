// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// supabase/functions/ask/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { email, utm_source, utm_medium, utm_campaign, referrer, user_agent } = await req.json();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify([
      {
        email,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
        user_agent
      }
    ]),
  });

  if (response.status === 409) {
    return new Response(JSON.stringify({ message: 'Already joined' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!response.ok) {
    const error = await response.text();
    return new Response(JSON.stringify({ error }), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ message: 'Joined successfully' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
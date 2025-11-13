'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AskPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [utm, setUtm] = useState({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    referrer: '',
    user_agent: ''
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    setUtm({
      utm_source: url.searchParams.get('utm_source') || '',
      utm_medium: url.searchParams.get('utm_medium') || '',
      utm_campaign: url.searchParams.get('utm_campaign') || '',
      referrer: document.referrer || '',
      user_agent: navigator.userAgent || ''
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const res = await fetch('https://ayeckgcillxfivvnyhaj.supabase.co/functions/v1/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          email: email.trim(),
          utm_source: utm.utm_source || '',
          utm_medium: utm.utm_medium || '',
          utm_campaign: utm.utm_campaign || '',
          referrer: utm.referrer || '',
          user_agent: utm.user_agent || ''
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.error || 'Failed to join waitlist.';
        setMessage(errorMessage);
      } else {
        setMessage('Successfully joined the waitlist!');
        setEmail('');
      }
    } catch (err) {
      console.error('Function error:', err);
      setMessage('Something went wrong.');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Ask a Question</h1>
      <p className="mb-6 text-gray-700">Get personalized financial guidance from MoneyXprt.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          className="border border-gray-300 rounded px-4 py-2"
        />
        <button type="submit" className="bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">
          Join Waitlist
        </button>
      </form>
      {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
    </main>
  );
}
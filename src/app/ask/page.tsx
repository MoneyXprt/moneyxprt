'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LegalLinks } from '@/components/LegalLinks';

export default function AskPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [joined, setJoined] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.error || 'Failed to join waitlist.';
        setMessage(errorMessage);
      } else {
        setJoined(true);
        setEmail('');
      }
    } catch (err) {
      console.error('Function error:', err);
      setMessage('Something went wrong.');
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0d1f15] px-6 py-16 text-white">
      <Link href="/" className="absolute left-6 top-6 min-h-11 py-2 text-sm font-semibold text-[#d4a843] transition hover:text-[#e2bb62]">
        ← Back
      </Link>
      <div className="w-full max-w-md animate-fade-in">
        {joined ? (
          <div className="text-center">
            <span aria-hidden="true" className="text-4xl">✓</span>
            <h1 className="mt-5 text-4xl font-bold tracking-[-0.045em]">You&apos;re on the list.</h1>
            <p className="mt-4 text-lg text-[#d4a843]">We&apos;ll reach out when access opens.</p>
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Join the waitlist.</h1>
            <p className="mt-4 text-lg leading-7 text-[#d4a843]">Free during private alpha.<br />Be first when access opens.</p>
            <form onSubmit={handleSubmit} className="mt-9 flex w-full flex-col gap-3">
              <input
                aria-label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="min-h-12 w-full rounded-xl border border-white/20 bg-white px-4 text-base text-[#0d1f15] placeholder:text-[#607066] outline-none focus:border-[#d4a843] focus:ring-2 focus:ring-[#d4a843]/30"
              />
              <button type="submit" className="min-h-11 w-full rounded-xl bg-[#d4a843] px-4 text-base font-bold text-[#0d1f15] transition hover:bg-[#e2bb62] disabled:opacity-60">
                Join the waitlist <span aria-hidden="true">→</span>
              </button>
            </form>
            {message && <p role="alert" className="mt-4 text-sm text-rose-300">{message}</p>}
          </>
        )}
      </div>
      <div className="absolute bottom-4 left-0 right-0"><LegalLinks /></div>
    </main>
  );
}

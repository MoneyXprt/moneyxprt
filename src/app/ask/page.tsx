'use client';

import { useState } from 'react';

export default function AskPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
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
      <h1 className="text-3xl font-bold mb-4">Join the MoneyXprt waitlist</h1>
      <p className="mb-6 text-gray-700">Leave your email and we&apos;ll let you know when access opens.</p>
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

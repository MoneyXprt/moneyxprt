'use client';
import { useState } from 'react';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || 'Could not join the waitlist.');
      setEmail('');
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not join the waitlist.');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-6 py-12">
      <h1 className="text-4xl font-bold mb-6">Join the Waitlist</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full p-3 border border-gray-300 rounded mb-4"
        />
        <button
          type="submit"
          className="w-full bg-black text-white py-3 rounded hover:bg-gray-800 transition"
        >
          Join Waitlist
        </button>
        {error && <p className="mt-4 text-red-600">{error}</p>}
        {success && <p className="mt-4 text-green-600">Thanks for joining the waitlist!</p>}
      </form>
    </main>
  );
}

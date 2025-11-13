'use client';
import { useState } from 'react';
import { supabase } from '@/app/utils/supabaseClient';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    console.log('🔍 SUBMITTING TO WAITLIST...');
    console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data, error } = await supabase.from('waitlist').insert([{ email }]);
    console.log('🚨 RESULT:', { data, error });
    console.log({ email, response: { data, error } });

    if (error) {
      setError(error.message);
    } else {
      setEmail('');
      setSuccess(true);
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
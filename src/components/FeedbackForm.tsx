'use client';

import { useState } from 'react';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

type FeedbackCategory = 'bug' | 'idea' | 'question';

export default function FeedbackForm({ userId }: { userId: string }) {
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    setState('sending');
    const { error } = await getBrowserSupabaseClient().from('product_feedback').insert({
      user_id: userId,
      category,
      message: body,
      page_path: window.location.pathname,
    });
    if (error) { setState('error'); return; }
    setMessage('');
    setState('sent');
  }

  return (
    <form onSubmit={submit} className="space-y-3 px-5 py-4">
      <p className="text-sm leading-5 text-gray-600">Tell us what would make MoneyXprt more useful. Your feedback is tied to this account so we can follow up in context.</p>
      <select aria-label="Feedback type" value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900">
        <option value="idea">Idea</option>
        <option value="bug">Bug</option>
        <option value="question">Question</option>
      </select>
      <textarea aria-label="Feedback" required maxLength={2_000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What happened, or what would you like to see?" className="min-h-24 w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900" />
      {state === 'error' && <p role="alert" className="text-xs text-rose-600">Could not send feedback. Please try again.</p>}
      {state === 'sent' && <p role="status" className="text-xs text-emerald-700">Thanks — your feedback was sent.</p>}
      <button disabled={state === 'sending'} className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{state === 'sending' ? 'Sending…' : 'Send feedback'}</button>
    </form>
  );
}

'use client';

import Link from 'next/link';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

export default function PlanResultsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">MoneyXprt</span>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-500">Your Plan</span>
          </div>
          <button
            onClick={() => getBrowserSupabaseClient().auth.signOut()}
            className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col items-center justify-center gap-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900">Your plan is being built.</h1>
          <p className="mt-2 text-gray-500 text-sm leading-relaxed">
            You&apos;ve completed the first three steps. Asset preferences and constraints
            are coming next — they&apos;ll personalise your investment strategy and timeline.
          </p>
        </div>

        {/* Steps recap */}
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {[
            { label: 'Freedom Vision', done: true },
            { label: 'Freedom Number', done: true },
            { label: 'Financial Snapshot', done: true },
            { label: 'Asset Preferences', done: false, locked: true },
            { label: 'Constraints', done: false, locked: true },
          ].map(step => (
            <div key={step.label} className="flex items-center gap-3 px-5 py-3.5">
              {step.done ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0">
                  {step.locked && (
                    <svg className="w-2.5 h-2.5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              )}
              <span className={`text-sm ${step.done ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {step.label}
              </span>
              {step.locked && (
                <span className="ml-auto text-[10px] font-medium text-gray-300 uppercase tracking-wide">Soon</span>
              )}
            </div>
          ))}
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
        >
          Back to dashboard
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </main>
    </div>
  );
}

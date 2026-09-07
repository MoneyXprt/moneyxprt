'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Full-screen chrome shared by every Life Events screen (selection + all guided
 * flows). Provides the distraction-free layout the flows need — no bottom nav,
 * a single back affordance, and an optional "Step X of Y" progress indicator
 * (both a text label and dots, per the design rules).
 *
 * The route group `/dashboard/life-events` is registered in
 * `dashboard/layout.tsx`'s FULLSCREEN_ROUTES so the app's BottomNav is hidden
 * here.
 *
 * @param step        1-indexed current step. Omit on non-wizard screens (e.g. selection).
 * @param totalSteps  Total steps in the flow. Omit on non-wizard screens.
 * @param onBack      Custom back handler (e.g. go to previous wizard step).
 *                    Defaults to browser back.
 */
export function LifeEventShell({
  children,
  step,
  totalSteps,
  onBack,
}: {
  children: ReactNode;
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
}) {
  const router = useRouter();
  const showProgress = typeof step === 'number' && typeof totalSteps === 'number';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (onBack ? onBack() : router.back())}
            aria-label="Go back"
            className="flex items-center justify-center w-11 h-11 -ml-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {showProgress && (
            <div className="flex items-center gap-2.5 flex-1">
              <span className="text-xs font-semibold text-gray-500 tabular-nums">
                Step {step} of {totalSteps}
              </span>
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {Array.from({ length: totalSteps! }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i < step! ? 'w-5 bg-emerald-500' : 'w-1.5 bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}

/**
 * Shown inside {@link LifeEventShell} when the auth session resolves to `anon` —
 * a plain-English prompt back to the dashboard (which hosts the sign-in flow).
 */
export function LifeEventAnonPrompt() {
  return (
    <div className="text-center pt-16">
      <p className="text-3xl mb-4" aria-hidden="true">
        🔒
      </p>
      <h1 className="text-lg font-bold text-gray-900 mb-1">Sign in to continue</h1>
      <p className="text-sm text-gray-500 mb-6">
        We&apos;ll pick up right here once you&apos;re signed in.
      </p>
      <a
        href="/dashboard"
        className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
      >
        Go to sign in
      </a>
    </div>
  );
}

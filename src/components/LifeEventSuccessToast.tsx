'use client';

import { useEffect, useState } from 'react';

const TOAST_DURATION_MS = 5_000;

/** One-time confirmation after spouse-business actions are added to Execute. */
export function LifeEventSuccessToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('added') !== 'spouse-business') return;

    setVisible(true);
    url.searchParams.delete('added');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    const timer = window.setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-4 top-16 z-50 mx-auto flex min-h-[52px] max-w-md items-center gap-3 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg" role="status">
      <span aria-hidden="true">✓</span>
      Business strategies added to your plan.
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss" className="ml-auto min-h-[44px] min-w-[44px] text-white/80">×</button>
    </div>
  );
}

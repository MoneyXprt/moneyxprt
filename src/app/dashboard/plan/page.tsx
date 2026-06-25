'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

/**
 * Flow controller for the "Build Your Plan" sequence.
 * Checks completion state for each of the first three onboarding steps and
 * redirects the user to the earliest incomplete step.
 *
 * Step order:
 *   1. Freedom Vision    → /dashboard/freedom-vision
 *   2. Freedom Number    → /dashboard/freedom-calculator
 *   3. Financial Snapshot → /dashboard/audit
 *   4. (all complete)   → /dashboard/plan/results
 */
export default function PlanFlowController() {
  const router = useRouter();

  useEffect(() => {
    const sb = getBrowserSupabaseClient();

    async function route() {
      // Auth check
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/dashboard/freedom-vision'); return; }

      // Fetch the latest freedom_profile for this user
      const { data: profile } = await sb
        .from('freedom_profiles')
        .select('freedom_type, freedom_number')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Step 1 — Freedom Vision: complete when freedom_type is set (last screen of vision)
      const visionDone = !!profile?.freedom_type;
      if (!visionDone) { router.replace('/dashboard/freedom-vision'); return; }

      // Step 2 — Freedom Number: complete when freedom_number > 0
      const numberDone = Number(profile?.freedom_number ?? 0) > 0;
      if (!numberDone) { router.replace('/dashboard/freedom-calculator'); return; }

      // Step 3 — Financial Snapshot: complete when any row exists
      const { count } = await sb
        .from('financial_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const snapshotDone = (count ?? 0) > 0;
      if (!snapshotDone) { router.replace('/dashboard/audit'); return; }

      // All three done → show the results/summary
      router.replace('/dashboard/plan/results');
    }

    route();
  }, [router]);

  // Render a minimal loading screen while the async check runs
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <div className="w-9 h-9 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading your plan…</p>
    </div>
  );
}

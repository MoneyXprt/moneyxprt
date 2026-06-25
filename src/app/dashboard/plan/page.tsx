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
 *   1. Freedom Vision      → /dashboard/freedom-vision
 *   2. Freedom Number      → /dashboard/freedom-calculator
 *   3. Financial Snapshot  → /dashboard/audit
 *   4. Asset Preferences   → /dashboard/asset-preferences
 *   5. Constraints         → /dashboard/constraints
 *   6. (all complete)      → /dashboard/plan/results
 */
export default function PlanFlowController() {
  const router = useRouter();

  useEffect(() => {
    const sb = getBrowserSupabaseClient();

    async function route() {
      // Use getSession() — reads from local storage / cookie without a network
      // round-trip, so it works reliably on first render after a redirect.
      const { data: { session } } = await sb.auth.getSession();
      console.log('[plan/route] session:', session ? `uid=${session.user.id}` : 'null');
      if (!session) { router.replace('/dashboard/freedom-vision'); return; }

      const userId = session.user.id;

      // Fetch the latest freedom_profile for this user
      const { data: profile, error: profileError } = await sb
        .from('freedom_profiles')
        .select('freedom_type, freedom_number_monthly')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      console.log('[plan/route] profile:', profile, 'error:', profileError?.message);

      // Step 1 — Freedom Vision: complete when freedom_type is set
      const visionDone = !!profile?.freedom_type;
      console.log('[plan/route] visionDone:', visionDone);
      if (!visionDone) { router.replace('/dashboard/freedom-vision'); return; }

      // Step 2 — Freedom Number: complete when freedom_number_monthly > 0
      const numberDone = Number(profile?.freedom_number_monthly ?? 0) > 0;
      console.log('[plan/route] numberDone:', numberDone, '(value:', profile?.freedom_number_monthly, ')');
      if (!numberDone) { router.replace('/dashboard/freedom-calculator'); return; }

      // Step 3 — Financial Snapshot: complete when any row exists.
      // Using a regular SELECT (GET request) instead of count/head (HEAD request)
      // so the auth token is applied the same way as the freedom_profiles query.
      const { data: snapRows, error: snapError } = await sb
        .from('financial_snapshots')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      console.log('[plan/route] snapRows (raw):', snapRows, 'error:', snapError?.message);

      const snapshotDone = Array.isArray(snapRows) && snapRows.length > 0;
      console.log('[plan/route] snapshotDone:', snapshotDone);
      if (!snapshotDone) { router.replace('/dashboard/audit'); return; }

      // Step 4 — Asset Preferences: complete when at least one row exists
      const { data: assetRows, error: assetError } = await sb
        .from('asset_preferences')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      console.log('[plan/route] assetRows (raw):', assetRows, 'error:', assetError?.message);

      const assetsDone = Array.isArray(assetRows) && assetRows.length > 0;
      console.log('[plan/route] assetsDone:', assetsDone);
      if (!assetsDone) { router.replace('/dashboard/asset-preferences'); return; }

      // Step 5 — Constraints: complete when a row exists
      const { data: constraints, error: constraintsError } = await sb
        .from('user_constraints')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      console.log('[plan/route] constraints:', constraints, 'error:', constraintsError?.message);

      const constraintsDone = !!constraints;
      if (!constraintsDone) { router.replace('/dashboard/constraints'); return; }

      // All five done → generate and show the plan
      console.log('[plan/route] all steps complete → /dashboard/plan/results');
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

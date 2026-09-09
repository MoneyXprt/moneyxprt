'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabaseClient } from '@/app/utils/supabaseClient';

/**
 * Flow controller for the "Build Your Plan" sequence.
 *
 * Step order:
 *   Phase 1:  1. Freedom Vision     → /dashboard/freedom-vision
 *             2. Freedom Number     → /dashboard/freedom-calculator
 *             3. Financial Snapshot → /dashboard/audit
 *   Phase 2:  4. Guided planning    → /dashboard/plan/phase2
 *             (covers asset preferences + constraints in one guided flow)
 *   Results:  → /dashboard/plan/results
 *
 * /dashboard/asset-preferences and /dashboard/constraints remain accessible
 * from Settings for later edits, but are no longer the primary flow path.
 */
export default function PlanFlowController() {
  const router = useRouter();

  useEffect(() => {
    const sb = getBrowserSupabaseClient();

    async function route() {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/dashboard/freedom-vision'); return; }

      const userId = session.user.id;

      const { data: profile } = await sb
        .from('freedom_profiles')
        .select('freedom_type, freedom_number_monthly')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const visionDone = !!profile?.freedom_type;
      if (!visionDone) { router.replace('/dashboard/freedom-vision'); return; }

      const numberDone = Number(profile?.freedom_number_monthly ?? 0) > 0;
      if (!numberDone) { router.replace('/dashboard/freedom-calculator'); return; }

      const { data: snapRows } = await sb
        .from('financial_snapshots')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      const snapshotDone = Array.isArray(snapRows) && snapRows.length > 0;
      if (!snapshotDone) { router.replace('/dashboard/audit'); return; }

      // Phase 2 is complete only after it has saved asset preferences and constraints.
      const [{ data: assetRows }, { data: constraints }] = await Promise.all([
        sb.from('asset_preferences').select('id').eq('user_id', userId).limit(1),
        sb.from('user_constraints').select('id').eq('user_id', userId).maybeSingle(),
      ]);
      const phase2Done = Array.isArray(assetRows) && assetRows.length > 0 && !!constraints;
      if (!phase2Done) { router.replace('/dashboard/plan/phase2'); return; }

      router.replace('/dashboard/plan/results');
    }

    route();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <div className="w-9 h-9 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading your plan…</p>
    </div>
  );
}

'use client';

import { use } from 'react';
import Link from 'next/link';
import { getLifeEventBySlug } from '@/app/lib/lifeEvents/config';
import { LifeEventShell } from '@/components/LifeEventShell';

/**
 * Placeholder for life events whose guided flow is not built yet
 * (`status: 'coming_soon'` in the config). Static flows like
 * `spouse-business/page.tsx` take routing precedence over this dynamic segment,
 * so this only renders for coming-soon or unknown slugs.
 *
 * Shows a helpful empty state — never a blank screen or a 404 — with the one
 * clear next action of picking a different event.
 */
export default function LifeEventPlaceholderPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const { event: slug } = use(params);
  const event = getLifeEventBySlug(slug);

  return (
    <LifeEventShell>
      <div className="text-center pt-12">
        <p className="text-4xl mb-4" aria-hidden="true">
          {event?.emoji ?? '🚧'}
        </p>
        <h1 className="text-lg font-bold text-gray-900 mb-1">
          {event ? `${event.label} — coming soon` : 'This flow isn’t ready yet'}
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-xs mx-auto">
          {event
            ? 'We’re building the guided flow for this. Soon you’ll be able to update your plan and see new opportunities from this change in a few taps.'
            : 'We couldn’t find that life event. Pick one from the list to get started.'}
        </p>
        <Link
          href="/dashboard/life-events"
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
        >
          Choose what changed
        </Link>
      </div>
    </LifeEventShell>
  );
}

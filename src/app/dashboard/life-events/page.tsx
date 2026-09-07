'use client';

import { useRouter } from 'next/navigation';
import { LIFE_EVENTS, type LifeEventDefinition } from '@/app/lib/lifeEvents/config';
import { useAuthSession } from '@/app/lib/useAuthSession';
import { LifeEventCard } from '@/components/LifeEventCard';
import { LifeEventShell, LifeEventAnonPrompt } from '@/components/LifeEventShell';

/**
 * Step 2 — Life event selection screen.
 *
 * Shows every event from {@link LIFE_EVENTS}. One tap selects and routes an
 * available event; coming-soon events remain visible but unavailable.
 * No multi-select — one life event is handled at a time.
 */
export default function LifeEventSelectionPage() {
  const router = useRouter();
  const { status } = useAuthSession();

  /** Route to the selected event's live guided flow. */
  function handleSelect(event: LifeEventDefinition) {
    router.push(event.flowPath);
  }

  return (
    <LifeEventShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">What changed?</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          We&apos;ll update your plan and surface any new opportunities.
        </p>
      </div>

      {status === 'loading' && <SelectionSkeleton />}

      {status === 'anon' && <LifeEventAnonPrompt />}

      {status === 'authed' && (
        <div className="grid grid-cols-2 gap-3">
          {LIFE_EVENTS.map((event) => (
            <LifeEventCard key={event.id} event={event} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </LifeEventShell>
  );
}

/**
 * Placeholder grid matching the real card dimensions exactly (2 cols, 112px min
 * height) so there is no layout shift when the events render.
 */
function SelectionSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3" aria-hidden="true">
      {LIFE_EVENTS.map((event) => (
        <div
          key={event.id}
          className="min-h-[112px] rounded-2xl border border-gray-100 bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  );
}

import type { LifeEventDefinition } from '@/app/lib/lifeEvents/config';

/**
 * A single tappable life-event tile on the selection screen.
 *
 * Shared component (not page-local) because the guided flows reuse it in their
 * headers/confirmations. Renders as a `<button>` so selection is one tap with no
 * text cursor; the parent owns navigation via `onSelect`.
 *
 * `coming_soon` events still render (so users see what's planned), but are
 * deliberately unavailable until their guided flow exists.
 */
export function LifeEventCard({
  event,
  onSelect,
}: {
  event: LifeEventDefinition;
  onSelect: (event: LifeEventDefinition) => void;
}) {
  const isComingSoon = event.status === 'coming_soon';

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      disabled={isComingSoon}
      aria-label={isComingSoon ? `${event.label} (coming soon)` : event.label}
      className="relative flex flex-col items-center justify-center gap-2 text-center min-h-[112px] px-3 py-5 rounded-2xl border border-gray-100 bg-white shadow-sm transition enabled:hover:border-gray-200 enabled:hover:bg-gray-50 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isComingSoon && (
        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
          Soon
        </span>
      )}
      <span className="text-3xl leading-none" aria-hidden="true">
        {event.emoji}
      </span>
      <span className="text-xs font-semibold text-gray-900 leading-tight">
        {event.label}
      </span>
    </button>
  );
}

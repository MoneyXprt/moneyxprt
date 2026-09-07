import Link from 'next/link';

/**
 * Home-dashboard entry point to the Life Events Engine. Rendered directly below
 * the Freedom Gap hero. Deliberately minimal — one line, one tap — so it reads
 * as an always-available "tell us what changed" affordance rather than another
 * card competing for attention.
 *
 * Tapping it opens the life event selection screen (`/dashboard/life-events`).
 */
export function SomethingChangedCard() {
  return (
    <Link
      href="/dashboard/life-events"
      className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 min-h-[44px] hover:bg-gray-50 hover:border-gray-200 transition active:scale-[0.99]"
    >
      <span className="text-sm font-semibold text-gray-900 leading-tight">
        Something changed in your financial life
      </span>
      <span className="text-gray-300 text-lg shrink-0" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

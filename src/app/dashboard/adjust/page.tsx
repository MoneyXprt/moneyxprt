import { redirect } from 'next/navigation';

/**
 * The "Something changed" flow has moved to the Life Events Engine at
 * `/dashboard/life-events`. This route is kept as a permanent redirect so
 * existing links, bookmarks, and any magic-link deep links continue to work.
 *
 * Do not re-add a flow here — build new life events in
 * `src/app/dashboard/life-events/` and `src/app/lib/lifeEvents/`.
 */
export default function AdjustRedirect() {
  redirect('/dashboard/life-events');
}

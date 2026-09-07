/**
 * Life Events Engine — the catalogue of events a user can report from
 * "Something changed in your financial life".
 *
 * This is the single data structure that drives the selection screen and the
 * router. Adding a new life event = adding one entry here (and building its
 * flow). Component code never hardcodes the list, the labels, or the routes.
 */

/** Stable identifier for a life event. Persisted/queried — never rename. */
export type LifeEventId =
  | 'spouse_business'
  | 'paid_off_debt'
  | 'received_bonus'
  | 'got_raise'
  | 'bought_property'
  | 'started_investing';

/**
 * `available`   — the guided flow at `flowPath` is built and live.
 * `coming_soon` — shown on the selection screen (so users see it's planned)
 *                 but routes to a placeholder instead of a real flow.
 */
export type LifeEventStatus = 'available' | 'coming_soon';

export interface LifeEventDefinition {
  id: LifeEventId;
  /** Leading emoji shown on the card. */
  emoji: string;
  /** Plain-English card label. No tax-code language. */
  label: string;
  /** Route for this event's guided flow. */
  flowPath: string;
  status: LifeEventStatus;
}

/**
 * Order matters — cards render in this order on the selection screen, roughly
 * most-common first.
 */
export const LIFE_EVENTS: readonly LifeEventDefinition[] = [
  {
    id: 'spouse_business',
    emoji: '💼',
    label: 'Spouse started a business',
    flowPath: '/dashboard/life-events/spouse-business',
    status: 'available',
  },
  {
    id: 'paid_off_debt',
    emoji: '✅',
    label: 'Paid off a debt',
    flowPath: '/dashboard/life-events/paid-off-debt',
    status: 'coming_soon',
  },
  {
    id: 'received_bonus',
    emoji: '💰',
    label: 'Received a bonus',
    flowPath: '/dashboard/life-events/received-bonus',
    status: 'coming_soon',
  },
  {
    id: 'got_raise',
    emoji: '📈',
    label: 'Got a raise',
    flowPath: '/dashboard/life-events/got-raise',
    status: 'coming_soon',
  },
  {
    id: 'bought_property',
    emoji: '🏠',
    label: 'Bought a property',
    flowPath: '/dashboard/life-events/bought-property',
    status: 'coming_soon',
  },
  {
    id: 'started_investing',
    emoji: '📊',
    label: 'Started investing',
    flowPath: '/dashboard/life-events/started-investing',
    status: 'coming_soon',
  },
] as const;

/** Look up a single life event by id. Returns `undefined` if unknown. */
export function getLifeEvent(id: string): LifeEventDefinition | undefined {
  return LIFE_EVENTS.find((event) => event.id === id);
}

/**
 * Look up a life event by the last segment of its `flowPath`
 * (e.g. `"spouse-business"` → the spouse-business event). Used by the dynamic
 * `[event]` route. Returns `undefined` if no event owns that slug.
 */
export function getLifeEventBySlug(slug: string): LifeEventDefinition | undefined {
  return LIFE_EVENTS.find((event) => event.flowPath.endsWith(`/${slug}`));
}

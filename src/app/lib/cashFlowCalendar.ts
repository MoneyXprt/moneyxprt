export interface CashFlowEvent { id: string; title: string; amount: number; direction: 'inflow' | 'outflow'; category: string; eventDate: string; recurrence: 'once' | 'monthly'; }
export type CashFlowEventInput = Omit<CashFlowEvent, 'id'>;

/** Returns a user-safe explanation when a manually entered cash-flow event is invalid. */
export function validateCashFlowEventInput(event: CashFlowEventInput): string | null {
  if (event.title.trim().length === 0) return 'Enter an event name.';
  if (event.title.trim().length > 100) return 'Event names must be 100 characters or fewer.';
  if (!Number.isFinite(event.amount) || event.amount <= 0 || event.amount > 1_000_000_000) return 'Enter an amount greater than $0.';
  if (event.direction !== 'inflow' && event.direction !== 'outflow') return 'Choose whether this is money in or money out.';
  if (event.recurrence !== 'once' && event.recurrence !== 'monthly') return 'Choose a valid recurrence.';
  if (!isCalendarDate(event.eventDate)) return 'Choose a valid event date.';
  return null;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Expands one-time and monthly events into the selected calendar month. */
export function eventsForMonth(events: readonly CashFlowEvent[], year: number, month: number): CashFlowEvent[] {
  return events.flatMap(event => {
    const source = new Date(`${event.eventDate}T00:00:00`);
    if (event.recurrence === 'once' && (source.getFullYear() !== year || source.getMonth() !== month)) return [];
    if (event.recurrence === 'monthly' && source > new Date(year, month + 1, 0)) return [];
    const date = event.recurrence === 'monthly' ? new Date(year, month, Math.min(source.getDate(), new Date(year, month + 1, 0).getDate())) : source;
    return [{ ...event, eventDate: date.toISOString().slice(0, 10) }];
  }).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

/** Calculates planned inflow, outflow, and net cash movement for visible events. */
export function cashFlowTotals(events: readonly CashFlowEvent[]): { inflow: number; outflow: number; net: number } {
  const inflow = events.filter(event => event.direction === 'inflow').reduce((sum, event) => sum + event.amount, 0);
  const outflow = events.filter(event => event.direction === 'outflow').reduce((sum, event) => sum + event.amount, 0);
  return { inflow, outflow, net: inflow - outflow };
}

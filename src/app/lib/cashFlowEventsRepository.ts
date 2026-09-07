import type { SupabaseClient } from '@supabase/supabase-js';
import { validateCashFlowEventInput, type CashFlowEvent, type CashFlowEventInput } from './cashFlowCalendar';

interface Row { id: string; title: string; amount: number; direction: 'inflow' | 'outflow'; category: string; event_date: string; recurrence: 'once' | 'monthly'; }

export async function listCashFlowEvents(client: SupabaseClient, userId: string): Promise<CashFlowEvent[]> {
  const { data, error } = await client.from('cash_flow_events').select('id,title,amount,direction,category,event_date,recurrence').eq('user_id', userId).order('event_date');
  if (error) throw new Error(error.message);
  return ((data as Row[] | null) ?? []).map(row => ({ id: row.id, title: row.title, amount: Number(row.amount), direction: row.direction, category: row.category, eventDate: row.event_date, recurrence: row.recurrence }));
}

export async function createCashFlowEvent(client: SupabaseClient, userId: string, event: CashFlowEventInput): Promise<void> {
  const validationError = validateCashFlowEventInput(event);
  if (validationError) throw new Error(validationError);
  const { error } = await client.from('cash_flow_events').insert({ user_id: userId, title: event.title.trim(), amount: event.amount, direction: event.direction, category: event.category, event_date: event.eventDate, recurrence: event.recurrence });
  if (error) throw new Error(error.message);
}

/** Removes one user-owned planned event. Row-level security prevents cross-account deletion. */
export async function deleteCashFlowEvent(client: SupabaseClient, eventId: string): Promise<void> {
  const { error } = await client.from('cash_flow_events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}

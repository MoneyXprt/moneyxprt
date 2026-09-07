import { expect, it } from 'vitest'; import { cashFlowTotals, eventsForMonth, validateCashFlowEventInput } from './cashFlowCalendar';
it('expands monthly events and totals cash flow', () => { const events = eventsForMonth([{ id: '1', title: 'Payday', amount: 5000, direction: 'inflow', category: 'income', eventDate: '2026-01-31', recurrence: 'monthly' }, { id: '2', title: 'Rent', amount: 2000, direction: 'outflow', category: 'housing', eventDate: '2026-02-01', recurrence: 'once' }], 2026, 1); expect(events.find(event => event.id === '1')?.eventDate).toBe('2026-02-28'); expect(cashFlowTotals(events)).toEqual({ inflow: 5000, outflow: 2000, net: 3000 }); });
it('rejects invalid manual cash-flow entries', () => {
  const valid = { title: 'Rent', amount: 2400, direction: 'outflow' as const, category: 'housing', eventDate: '2026-02-28', recurrence: 'monthly' as const };
  expect(validateCashFlowEventInput(valid)).toBeNull();
  expect(validateCashFlowEventInput({ ...valid, title: '   ' })).toBe('Enter an event name.');
  expect(validateCashFlowEventInput({ ...valid, amount: 0 })).toBe('Enter an amount greater than $0.');
  expect(validateCashFlowEventInput({ ...valid, eventDate: '2026-02-31' })).toBe('Choose a valid event date.');
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260912000001_extend_debt_corrections_for_rate_and_payment.sql');

describe('rate and payment debt-correction migration contract', () => {
  it('allows rate and payment audit rows and validates both as non-negative', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("'interest_rate', 'minimum_payment'");
    expect(migration).toContain("if resolved_interest_rate < 0 then raise exception 'Interest rate cannot be negative.'");
    expect(migration).toContain("if resolved_minimum_payment < 0 then raise exception 'Minimum payment cannot be negative.'");
  });

  it('logs rate-only and payment-only changes independently', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/if debt_row\.interest_rate is distinct from resolved_interest_rate then[\s\S]*?'interest_rate'/);
    expect(migration).toMatch(/if debt_row\.minimum_payment is distinct from resolved_minimum_payment then[\s\S]*?'minimum_payment'/);
  });

  it('keeps separate balance and rate audit inserts for a combined correction', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toMatch(/if debt_row\.current_balance is distinct from target_current_balance then[\s\S]*?'current_balance'/);
    expect(migration).toMatch(/if debt_row\.interest_rate is distinct from resolved_interest_rate then[\s\S]*?'interest_rate'/);
  });
});

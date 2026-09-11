import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260910000001_add_debt_sync_history.sql');

describe('debt sync history migration contract', () => {
  it('records each changed Audit-managed metadata field', () => {
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("field_changed in ('name', 'interest_rate', 'minimum_payment')");
    expect(migration).toMatch(/if debt_row\.name is distinct from target_name then[\s\S]*?'name'/);
    expect(migration).toMatch(/if debt_row\.interest_rate is distinct from target_interest_rate then[\s\S]*?'interest_rate'/);
    expect(migration).toMatch(/if debt_row\.minimum_payment is distinct from target_minimum_payment then[\s\S]*?'minimum_payment'/);
  });
});

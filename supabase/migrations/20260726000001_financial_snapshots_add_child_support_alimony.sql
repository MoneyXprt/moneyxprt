-- Monthly child support and alimony/spousal support paid — fixed monthly outflows
-- alongside extra_debt_payments. Nullable with no default: existing rows and any
-- snapshot where these weren't asked about leave them null, and application code
-- treats null as 0 (no payment).
alter table financial_snapshots
  add column if not exists child_support_monthly numeric,
  add column if not exists alimony_monthly numeric;

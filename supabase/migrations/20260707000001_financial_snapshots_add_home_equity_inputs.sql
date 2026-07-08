alter table financial_snapshots
  add column if not exists primary_residence_value numeric not null default 0,
  add column if not exists mortgage_balance         numeric not null default 0;

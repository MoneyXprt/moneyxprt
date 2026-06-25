alter table financial_snapshots
  add column if not exists monthly_rental_income   numeric not null default 0,
  add column if not exists monthly_dividend_income numeric not null default 0;

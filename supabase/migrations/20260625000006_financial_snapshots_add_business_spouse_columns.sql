alter table financial_snapshots
  add column if not exists primary_business_net_profit       numeric not null default 0,
  add column if not exists primary_business_type             text    not null default '',
  add column if not exists primary_hours_per_week_in_business numeric not null default 0,
  add column if not exists spouse_w2_income                  numeric not null default 0,
  add column if not exists spouse_business_revenue           numeric not null default 0,
  add column if not exists spouse_business_net_profit        numeric not null default 0,
  add column if not exists spouse_business_type              text    not null default '',
  add column if not exists spouse_hours_per_week_in_business numeric not null default 0;

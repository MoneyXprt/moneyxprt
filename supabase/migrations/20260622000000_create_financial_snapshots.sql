create table financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  snapshot_date timestamptz default now(),

  -- income
  w2_income numeric default 0,
  bonus_income numeric default 0,
  income_1099 numeric default 0,
  spouse_works boolean default false,

  -- household
  filing_status text default 'mfj',
  state text default 'CA',
  dependents_under_18 integer default 0,
  has_business_entity boolean default false,
  business_revenue numeric default 0,

  -- financial position
  current_tax_paid numeric default 0,
  monthly_spend numeric default 0,
  emergency_fund numeric default 0,
  retirement_balance numeric default 0,
  home_equity numeric default 0,
  traditional_ira_balance numeric default 0,
  has_hsa_available boolean default false,

  -- real estate & retirement enrichment
  considering_real_estate boolean default false,
  planned_property_value numeric,
  reps_qualified boolean,
  employer_401k_allows_after_tax boolean,

  created_at timestamptz default now()
);

-- Row Level Security: users only see and write their own snapshots
alter table financial_snapshots enable row level security;

create policy "Users can view own snapshots"
  on financial_snapshots for select
  using (auth.uid() = user_id);

create policy "Users can insert own snapshots"
  on financial_snapshots for insert
  with check (auth.uid() = user_id);

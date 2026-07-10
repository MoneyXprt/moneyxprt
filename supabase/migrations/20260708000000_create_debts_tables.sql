create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  name text not null,
  debt_type text not null check (debt_type in ('car_loan','student_loan','personal_loan','credit_card','business_loan','other')),
  original_balance numeric not null,
  current_balance numeric not null,
  interest_rate numeric not null,
  minimum_payment numeric not null,
  is_active boolean not null default true,
  payoff_order integer,
  created_at timestamptz default now(),
  paid_off_at timestamptz
);

create index idx_debts_user_active on debts (user_id, is_active);

alter table debts enable row level security;

create policy "Users can view own debts"
  on debts for select
  using (auth.uid() = user_id);

create policy "Users can insert own debts"
  on debts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own debts"
  on debts for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own debts"
  on debts for delete
  using (auth.uid() = user_id);

create table debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid references debts(id) not null,
  user_id uuid references auth.users(id) not null,
  amount numeric not null,
  payment_date date not null,
  source text not null check (source in ('regular','lump_sum')),
  note text,
  created_at timestamptz default now()
);

create index idx_debt_payments_debt on debt_payments (debt_id);
create index idx_debt_payments_user_date on debt_payments (user_id, payment_date);

alter table debt_payments enable row level security;

create policy "Users can view own debt payments"
  on debt_payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own debt payments"
  on debt_payments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own debt payments"
  on debt_payments for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own debt payments"
  on debt_payments for delete
  using (auth.uid() = user_id);

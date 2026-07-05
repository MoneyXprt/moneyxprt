create table bonus_plan (
  user_id uuid references auth.users(id) primary key,
  frequency text not null,
  plan_amount numeric not null,
  payment_month integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table bonus_plan
  add constraint frequency_check check (frequency in ('monthly', 'quarterly', 'annual')),
  add constraint payment_month_check check (payment_month is null or payment_month between 1 and 12);

alter table bonus_plan enable row level security;

create policy "Users can view own bonus plan"
  on bonus_plan for select
  using (auth.uid() = user_id);

create policy "Users can insert own bonus plan"
  on bonus_plan for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bonus plan"
  on bonus_plan for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_bonus_plan_updated_at
  before update on bonus_plan
  for each row execute function public.set_updated_at();

create table bonus_payments_actual (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  amount numeric not null,
  date_paid date not null,
  created_at timestamptz default now()
);

create index idx_bonus_payments_actual_user_date
  on bonus_payments_actual (user_id, date_paid);

alter table bonus_payments_actual enable row level security;

create policy "Users can view own bonus payments"
  on bonus_payments_actual for select
  using (auth.uid() = user_id);

create policy "Users can insert own bonus payments"
  on bonus_payments_actual for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bonus payments"
  on bonus_payments_actual for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own bonus payments"
  on bonus_payments_actual for delete
  using (auth.uid() = user_id);

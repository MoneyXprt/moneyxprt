create table financial_phase_status (
  user_id uuid references auth.users(id) primary key,
  phase text not null check (phase in ('funding_mini_ef','paying_debt','building_full_ef','assets_unlocked')),
  updated_at timestamptz not null default now()
);

alter table financial_phase_status enable row level security;

create policy "Users can view own financial phase"
  on financial_phase_status for select
  using (auth.uid() = user_id);

create policy "Users can insert own financial phase"
  on financial_phase_status for insert
  with check (auth.uid() = user_id);

create policy "Users can update own financial phase"
  on financial_phase_status for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at current (function created in 20260625000003_create_user_constraints.sql)
create trigger trg_financial_phase_status_updated_at
  before update on financial_phase_status
  for each row execute function public.set_updated_at();

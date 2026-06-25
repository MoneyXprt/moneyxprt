create table user_constraints (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) not null unique, -- unique enables upsert
  capital_per_year  numeric not null default 12000,
  hours_per_week    numeric not null default 5,
  risk_tolerance    text not null default 'moderate',
  hard_constraints  jsonb not null default '[]',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table user_constraints enable row level security;

create policy "Users can view own constraints"
  on user_constraints for select
  using (auth.uid() = user_id);

create policy "Users can insert own constraints"
  on user_constraints for insert
  with check (auth.uid() = user_id);

create policy "Users can update own constraints"
  on user_constraints for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_user_constraints_updated_at
  before update on user_constraints
  for each row execute function public.set_updated_at();

-- Migration: create_material_participation_logs
-- Tracks IRS-defensible material participation hours for W2/real estate tax purposes.

create table if not exists public.material_participation_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  hours_logged     numeric(6, 2) not null check (hours_logged > 0),
  description      text not null,
  irs_category     text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_material_participation_logs_updated_at
  before update on public.material_participation_logs
  for each row
  execute function public.set_updated_at();

-- Indexes
create index if not exists idx_material_participation_logs_user_id
  on public.material_participation_logs(user_id);

create index if not exists idx_material_participation_logs_date
  on public.material_participation_logs(user_id, date desc);

-- Row-Level Security: users can only see and mutate their own rows
alter table public.material_participation_logs enable row level security;

create policy "Users can select their own logs"
  on public.material_participation_logs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on public.material_participation_logs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own logs"
  on public.material_participation_logs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own logs"
  on public.material_participation_logs
  for delete
  using (auth.uid() = user_id);

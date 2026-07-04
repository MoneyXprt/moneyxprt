create table execution_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  description text,
  category text not null,
  phase integer not null,
  strategy_id text,
  estimated_annual_value numeric default 0,
  estimated_months_saved numeric default 0,
  completed boolean default false,
  completed_at timestamptz,
  due_date date,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table execution_actions enable row level security;

create policy "Users can read own actions"
  on execution_actions for select
  using (auth.uid() = user_id);

create policy "Users can insert own actions"
  on execution_actions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own actions"
  on execution_actions for update
  using (auth.uid() = user_id);

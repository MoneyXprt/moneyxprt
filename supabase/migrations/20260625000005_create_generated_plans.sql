create table generated_plans (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid references auth.users(id) not null unique,
  freedom_gap                 jsonb,
  phases                      jsonb,
  tax_strategy_stack          jsonb,
  asset_roadmap               jsonb,
  deployable_capital_per_year numeric,
  ai_narrative                text,
  projected_freedom_date      date,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table generated_plans enable row level security;

create policy "Users can view own plan"
  on generated_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own plan"
  on generated_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plan"
  on generated_plans for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger trg_generated_plans_updated_at
  before update on generated_plans
  for each row execute function public.set_updated_at();

create table freedom_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) not null,
  -- monthly category amounts
  housing             numeric not null default 0,
  health_insurance    numeric not null default 0,
  food                numeric not null default 0,
  transportation      numeric not null default 0,
  travel              numeric not null default 0,
  kids_family         numeric not null default 0,
  savings_buffer      numeric not null default 0,
  miscellaneous       numeric not null default 0,
  -- derived totals (stored for easy querying)
  freedom_number      numeric not null default 0,  -- monthly total
  portfolio_target    numeric not null default 0,  -- freedom_number × 300 (4% rule)
  created_at          timestamptz not null default now()
);

alter table freedom_profiles enable row level security;

create policy "Users can view own freedom profiles"
  on freedom_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own freedom profiles"
  on freedom_profiles for insert
  with check (auth.uid() = user_id);

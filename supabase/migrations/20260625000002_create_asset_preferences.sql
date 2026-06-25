create table asset_preferences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) not null,
  asset_type  text not null,
  selected    boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table asset_preferences enable row level security;

create policy "Users can view own asset preferences"
  on asset_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert own asset preferences"
  on asset_preferences for insert
  with check (auth.uid() = user_id);

-- Required for the replace-on-revisit pattern (delete all, re-insert selections)
create policy "Users can delete own asset preferences"
  on asset_preferences for delete
  using (auth.uid() = user_id);

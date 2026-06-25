-- Add vision / timeline / freedom-type columns captured by the Freedom Vision screen.
-- Nullable so existing calculator-only rows are unaffected.
alter table freedom_profiles
  add column if not exists vision_text    text,
  add column if not exists target_free_age integer,
  add column if not exists freedom_type   text;   -- 'never_work' | 'work_optional' | 'lower_stress'

-- The vision screen does an update-or-insert on the user's most recent row,
-- so we need an UPDATE policy in addition to the existing INSERT policy.
create policy "Users can update own freedom profiles"
  on freedom_profiles for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

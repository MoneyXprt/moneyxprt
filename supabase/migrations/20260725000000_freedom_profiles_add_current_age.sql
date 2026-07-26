-- Add the "your age today" field captured alongside target_free_age on the
-- Freedom Vision screen. Nullable so existing rows are unaffected.
alter table freedom_profiles
  add column if not exists current_age integer;

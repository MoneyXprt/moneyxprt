create table public.debt_sync_history (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete restrict,
  user_id uuid not null references auth.users(id),
  field_changed text not null check (
    field_changed in ('name', 'interest_rate', 'minimum_payment')
  ),
  old_value jsonb not null,
  new_value jsonb not null,
  synced_at timestamptz not null default now()
);

create index idx_debt_sync_history_debt_synced_at
  on public.debt_sync_history (debt_id, synced_at desc);

alter table public.debt_sync_history enable row level security;

revoke all privileges on table public.debt_sync_history from public;
revoke all privileges on table public.debt_sync_history from anon;
revoke all privileges on table public.debt_sync_history from authenticated;

grant select on table public.debt_sync_history to authenticated;

create policy "Users can view own debt sync history"
  on public.debt_sync_history
  for select
  to authenticated
  using (auth.uid() = user_id);

create function public.sync_audit_debt_metadata(
  target_debt_id uuid,
  target_name text,
  target_interest_rate numeric,
  target_minimum_payment numeric
)
returns public.debts
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_row public.debts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if char_length(btrim(coalesce(target_name, ''))) = 0 then
    raise exception 'Debt name is required.';
  end if;

  if target_interest_rate < 0 or target_minimum_payment < 0 then
    raise exception 'Debt metadata cannot be negative.';
  end if;

  select * into debt_row
  from public.debts
  where id = target_debt_id
  for update;

  if not found or debt_row.user_id <> auth.uid() then
    raise exception 'Debt record not found.';
  end if;

  if debt_row.name is distinct from target_name then
    insert into public.debt_sync_history
      (debt_id, user_id, field_changed, old_value, new_value)
    values
      (debt_row.id, auth.uid(), 'name',
       to_jsonb(debt_row.name), to_jsonb(target_name));
  end if;

  if debt_row.interest_rate is distinct from target_interest_rate then
    insert into public.debt_sync_history
      (debt_id, user_id, field_changed, old_value, new_value)
    values
      (debt_row.id, auth.uid(), 'interest_rate',
       to_jsonb(debt_row.interest_rate), to_jsonb(target_interest_rate));
  end if;

  if debt_row.minimum_payment is distinct from target_minimum_payment then
    insert into public.debt_sync_history
      (debt_id, user_id, field_changed, old_value, new_value)
    values
      (debt_row.id, auth.uid(), 'minimum_payment',
       to_jsonb(debt_row.minimum_payment), to_jsonb(target_minimum_payment));
  end if;

  update public.debts
  set name = target_name,
      interest_rate = target_interest_rate,
      minimum_payment = target_minimum_payment
  where id = debt_row.id
  returning * into debt_row;

  return debt_row;
end;
$$;

revoke all on function public.sync_audit_debt_metadata(uuid, text, numeric, numeric)
  from public;
revoke execute on function public.sync_audit_debt_metadata(uuid, text, numeric, numeric)
  from anon;
grant execute on function public.sync_audit_debt_metadata(uuid, text, numeric, numeric)
  to authenticated;

alter table public.debt_corrections drop constraint if exists debt_corrections_field_changed_check;
alter table public.debt_corrections add constraint debt_corrections_field_changed_check check (field_changed in ('current_balance', 'original_balance', 'is_active', 'paid_off_at'));

create or replace function public.correct_debt_record(
  target_debt_id uuid,
  target_current_balance numeric,
  target_is_active boolean,
  correction_reason text,
  target_original_balance numeric
)
returns public.debts
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_row public.debts%rowtype;
  target_paid_off_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if char_length(btrim(coalesce(correction_reason, ''))) < 10 then raise exception 'A correction reason of at least 10 characters is required.'; end if;
  if target_current_balance < 0 then raise exception 'Current balance cannot be negative.'; end if;
  if target_original_balance <= 0 then raise exception 'Original balance must be greater than zero.'; end if;
  if target_original_balance < target_current_balance then raise exception 'Original balance must be at least the current balance.'; end if;
  if target_current_balance = 0 and target_is_active then raise exception 'An active debt must have a balance greater than zero.'; end if;
  if target_current_balance > 0 and not target_is_active then raise exception 'A paid-off debt must have a current balance of zero.'; end if;
  select * into debt_row from public.debts where id = target_debt_id for update;
  if not found or debt_row.user_id <> auth.uid() then raise exception 'Debt record not found.'; end if;
  target_paid_off_at := case when target_is_active then null else coalesce(debt_row.paid_off_at, now()) end;
  if debt_row.original_balance is not distinct from target_original_balance and debt_row.current_balance is not distinct from target_current_balance and debt_row.is_active is not distinct from target_is_active and debt_row.paid_off_at is not distinct from target_paid_off_at then raise exception 'No debt fields were changed.'; end if;
  if debt_row.original_balance is distinct from target_original_balance then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'original_balance', to_jsonb(debt_row.original_balance), to_jsonb(target_original_balance), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.current_balance is distinct from target_current_balance then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'current_balance', to_jsonb(debt_row.current_balance), to_jsonb(target_current_balance), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.is_active is distinct from target_is_active then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'is_active', to_jsonb(debt_row.is_active), to_jsonb(target_is_active), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.paid_off_at is distinct from target_paid_off_at then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'paid_off_at', coalesce(to_jsonb(debt_row.paid_off_at), 'null'::jsonb), coalesce(to_jsonb(target_paid_off_at), 'null'::jsonb), btrim(correction_reason), auth.uid());
  end if;
  update public.debts set original_balance = target_original_balance, current_balance = target_current_balance, is_active = target_is_active, paid_off_at = target_paid_off_at where id = target_debt_id returning * into debt_row;
  with ranked_debts as (select id, row_number() over (order by current_balance asc, id asc) as next_order from public.debts where user_id = auth.uid() and is_active)
  update public.debts set payoff_order = ranked_debts.next_order from ranked_debts where debts.id = ranked_debts.id;
  update public.debts set payoff_order = null where user_id = auth.uid() and not is_active;
  return debt_row;
end;
$$;

revoke all on function public.correct_debt_record(uuid, numeric, boolean, text, numeric) from public;
grant execute on function public.correct_debt_record(uuid, numeric, boolean, text, numeric) to authenticated;

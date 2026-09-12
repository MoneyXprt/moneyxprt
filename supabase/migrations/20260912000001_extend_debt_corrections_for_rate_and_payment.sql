alter table public.debt_corrections drop constraint if exists debt_corrections_field_changed_check;
alter table public.debt_corrections add constraint debt_corrections_field_changed_check check (
  field_changed in ('current_balance', 'original_balance', 'interest_rate', 'minimum_payment', 'is_active', 'paid_off_at')
);

drop function if exists public.correct_debt_record(uuid, numeric, boolean, text, numeric);

create function public.correct_debt_record(
  target_debt_id uuid,
  target_current_balance numeric,
  target_is_active boolean,
  correction_reason text,
  target_original_balance numeric,
  target_interest_rate numeric default null,
  target_minimum_payment numeric default null
)
returns public.debts
language plpgsql
security definer
set search_path = public
as $$
declare
  debt_row public.debts%rowtype;
  target_paid_off_at timestamptz;
  resolved_interest_rate numeric;
  resolved_minimum_payment numeric;
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

  resolved_interest_rate := coalesce(target_interest_rate, debt_row.interest_rate);
  resolved_minimum_payment := coalesce(target_minimum_payment, debt_row.minimum_payment);
  if resolved_interest_rate < 0 then raise exception 'Interest rate cannot be negative.'; end if;
  if resolved_minimum_payment < 0 then raise exception 'Minimum payment cannot be negative.'; end if;

  target_paid_off_at := case when target_is_active then null else coalesce(debt_row.paid_off_at, now()) end;
  if debt_row.original_balance is not distinct from target_original_balance
    and debt_row.current_balance is not distinct from target_current_balance
    and debt_row.interest_rate is not distinct from resolved_interest_rate
    and debt_row.minimum_payment is not distinct from resolved_minimum_payment
    and debt_row.is_active is not distinct from target_is_active
    and debt_row.paid_off_at is not distinct from target_paid_off_at then
    raise exception 'No debt fields were changed.';
  end if;

  if debt_row.original_balance is distinct from target_original_balance then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'original_balance', to_jsonb(debt_row.original_balance), to_jsonb(target_original_balance), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.current_balance is distinct from target_current_balance then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'current_balance', to_jsonb(debt_row.current_balance), to_jsonb(target_current_balance), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.interest_rate is distinct from resolved_interest_rate then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'interest_rate', to_jsonb(debt_row.interest_rate), to_jsonb(resolved_interest_rate), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.minimum_payment is distinct from resolved_minimum_payment then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'minimum_payment', to_jsonb(debt_row.minimum_payment), to_jsonb(resolved_minimum_payment), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.is_active is distinct from target_is_active then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'is_active', to_jsonb(debt_row.is_active), to_jsonb(target_is_active), btrim(correction_reason), auth.uid());
  end if;
  if debt_row.paid_off_at is distinct from target_paid_off_at then
    insert into public.debt_corrections (debt_id, field_changed, old_value, new_value, reason, corrected_by) values (target_debt_id, 'paid_off_at', coalesce(to_jsonb(debt_row.paid_off_at), 'null'::jsonb), coalesce(to_jsonb(target_paid_off_at), 'null'::jsonb), btrim(correction_reason), auth.uid());
  end if;

  update public.debts
  set original_balance = target_original_balance,
      current_balance = target_current_balance,
      interest_rate = resolved_interest_rate,
      minimum_payment = resolved_minimum_payment,
      is_active = target_is_active,
      paid_off_at = target_paid_off_at
  where id = target_debt_id
  returning * into debt_row;

  with ranked_debts as (select id, row_number() over (order by current_balance asc, id asc) as next_order from public.debts where user_id = auth.uid() and is_active)
  update public.debts set payoff_order = ranked_debts.next_order from ranked_debts where debts.id = ranked_debts.id;
  update public.debts set payoff_order = null where user_id = auth.uid() and not is_active;
  return debt_row;
end;
$$;

revoke all on function public.correct_debt_record(uuid, numeric, boolean, text, numeric, numeric, numeric) from public;
revoke all on function public.correct_debt_record(uuid, numeric, boolean, text, numeric, numeric, numeric) from anon;
revoke all on function public.correct_debt_record(uuid, numeric, boolean, text, numeric, numeric, numeric) from authenticated;
grant execute on function public.correct_debt_record(uuid, numeric, boolean, text, numeric, numeric, numeric) to authenticated;

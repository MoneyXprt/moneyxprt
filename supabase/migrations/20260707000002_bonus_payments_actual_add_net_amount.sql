alter table bonus_payments_actual
  add column if not exists net_amount numeric;

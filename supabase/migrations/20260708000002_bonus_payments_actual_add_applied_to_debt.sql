alter table bonus_payments_actual
  add column if not exists applied_to_debt boolean not null default false;

alter table financial_snapshots
  add column if not exists student_loan_payment  numeric not null default 0,
  add column if not exists personal_loan_payment numeric not null default 0,
  add column if not exists credit_card_payment   numeric not null default 0,
  add column if not exists business_loan_payment numeric not null default 0,
  add column if not exists other_debt_label      text    not null default '',
  add column if not exists other_debt_balance    numeric not null default 0,
  add column if not exists other_debt_rate       numeric not null default 0,
  add column if not exists other_debt_payment    numeric not null default 0,
  add column if not exists extra_debt_payments   numeric not null default 0;

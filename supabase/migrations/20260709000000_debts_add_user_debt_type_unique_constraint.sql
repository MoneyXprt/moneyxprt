alter table debts
  add constraint debts_user_id_debt_type_unique unique (user_id, debt_type);

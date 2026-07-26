-- How much of a logged bonus payment's net amount is still available to deploy
-- toward assets/debt, after real-world spending (tuition, etc.) is accounted for.
-- Nullable with no default: existing rows and any payment where nothing has been
-- spent yet leave this null, and application code treats null as "same as
-- net_amount" (the full net bonus is still available).
alter table bonus_payments_actual
  add column if not exists deployable_amount numeric;

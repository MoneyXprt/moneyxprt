-- Startup Costs Deduction (IRC §195) eligibility inputs. Nullable with no
-- default: existing rows leave these null, and application code treats a null
-- boolean as false and a null cost figure as 0 (not eligible).
alter table financial_snapshots
  add column if not exists is_new_business boolean,
  add column if not exists startup_costs_incurred numeric;

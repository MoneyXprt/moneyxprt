-- Home Office Deduction (IRC §280A(c)) eligibility inputs. Nullable with no
-- default: existing rows leave these null, and application code treats a null
-- boolean as false and a null square footage as 0 (not eligible).
alter table financial_snapshots
  add column if not exists has_dedicated_home_office boolean,
  add column if not exists home_office_square_footage numeric;

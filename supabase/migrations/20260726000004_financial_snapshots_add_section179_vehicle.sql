-- Section 179 Heavy Vehicle Deduction (IRC §179) eligibility inputs. Nullable
-- with no default: existing rows leave these null, and application code treats
-- a null boolean as false and a null dollar/percent figure as 0 (not eligible).
alter table financial_snapshots
  add column if not exists has_heavy_vehicle boolean,
  add column if not exists vehicle_purchase_price numeric,
  add column if not exists vehicle_business_use_percent numeric;

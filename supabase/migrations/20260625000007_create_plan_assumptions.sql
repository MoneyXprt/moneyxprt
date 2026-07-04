CREATE TABLE IF NOT EXISTS public.plan_assumptions (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_monthly_12          numeric     NOT NULL DEFAULT 0,
  business_monthly_36          numeric     NOT NULL DEFAULT 0,
  spouse_business_monthly_12   numeric     NOT NULL DEFAULT 0,
  spouse_business_monthly_36   numeric     NOT NULL DEFAULT 0,
  digital_products_monthly_12  numeric     NOT NULL DEFAULT 1000,
  digital_products_monthly_36  numeric     NOT NULL DEFAULT 5000,
  digital_products_peak        numeric     NOT NULL DEFAULT 5000,
  first_rental_delay_years     integer     NOT NULL DEFAULT 0,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.plan_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assumptions"
  ON public.plan_assumptions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

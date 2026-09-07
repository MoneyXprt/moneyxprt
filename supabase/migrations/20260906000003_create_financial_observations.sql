-- Canonical time-series primitive for financial tracking and monthly check-ins.

CREATE TABLE IF NOT EXISTS public.financial_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (metric IN (
    'net_worth', 'cash', 'total_debt', 'investments',
    'monthly_income', 'monthly_spend', 'passive_income'
  )),
  value numeric NOT NULL,
  observed_on date NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'snapshot', 'actual')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, metric, observed_on, source)
);

CREATE INDEX IF NOT EXISTS financial_observations_user_metric_date_idx
  ON public.financial_observations (user_id, metric, observed_on DESC);

ALTER TABLE public.financial_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own financial observations"
  ON public.financial_observations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own financial observations"
  ON public.financial_observations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own financial observations"
  ON public.financial_observations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own financial observations"
  ON public.financial_observations FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_financial_observations_updated_at ON public.financial_observations;
CREATE TRIGGER trg_financial_observations_updated_at
  BEFORE UPDATE ON public.financial_observations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

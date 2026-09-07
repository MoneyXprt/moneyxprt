CREATE TABLE IF NOT EXISTS public.investment_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_value numeric NOT NULL CHECK (portfolio_value >= 0),
  cumulative_contributions numeric NOT NULL DEFAULT 0 CHECK (cumulative_contributions >= 0),
  observed_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, observed_on)
);

CREATE INDEX IF NOT EXISTS investment_checkins_user_date_idx ON public.investment_checkins (user_id, observed_on);
ALTER TABLE public.investment_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own investment checkins" ON public.investment_checkins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investment checkins" ON public.investment_checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investment checkins" ON public.investment_checkins FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own investment checkins" ON public.investment_checkins FOR DELETE USING (auth.uid() = user_id);

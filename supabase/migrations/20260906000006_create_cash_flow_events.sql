CREATE TABLE IF NOT EXISTS public.cash_flow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100), amount numeric NOT NULL CHECK (amount >= 0),
  direction text NOT NULL CHECK (direction IN ('inflow', 'outflow')), category text NOT NULL DEFAULT 'other',
  event_date date NOT NULL, recurrence text NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once', 'monthly')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cash_flow_events_user_date_idx ON public.cash_flow_events (user_id, event_date);
ALTER TABLE public.cash_flow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cash flow events" ON public.cash_flow_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cash flow events" ON public.cash_flow_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash flow events" ON public.cash_flow_events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cash flow events" ON public.cash_flow_events FOR DELETE USING (auth.uid() = user_id);

-- Manual goal buckets for earmarked savings and investing goals.

CREATE TABLE IF NOT EXISTS public.goal_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  category text NOT NULL CHECK (category IN (
    'emergency', 'home', 'travel', 'investment', 'education', 'other'
  )),
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_amount numeric NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_buckets_user_created_idx
  ON public.goal_buckets (user_id, created_at DESC);

ALTER TABLE public.goal_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal buckets"
  ON public.goal_buckets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goal buckets"
  ON public.goal_buckets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goal buckets"
  ON public.goal_buckets FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goal buckets"
  ON public.goal_buckets FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_goal_buckets_updated_at ON public.goal_buckets;
CREATE TRIGGER trg_goal_buckets_updated_at
  BEFORE UPDATE ON public.goal_buckets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

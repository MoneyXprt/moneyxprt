-- Allow multiple generated_plans rows per user (plan history)
ALTER TABLE public.generated_plans
  DROP CONSTRAINT IF EXISTS generated_plans_user_id_unique;

ALTER TABLE public.generated_plans
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;

-- Existing single rows per user are all current
UPDATE public.generated_plans SET is_current = true;

-- Index for fast "fetch current plan" queries
CREATE INDEX IF NOT EXISTS generated_plans_user_current_idx
  ON public.generated_plans (user_id, is_current, created_at DESC);

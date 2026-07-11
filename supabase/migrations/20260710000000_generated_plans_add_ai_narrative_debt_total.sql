-- Stores the totalActiveDebt figure used to generate the currently-saved ai_narrative,
-- so results/page.tsx can detect when debt balances have moved enough to invalidate it.
ALTER TABLE public.generated_plans
  ADD COLUMN IF NOT EXISTS ai_narrative_debt_total numeric;

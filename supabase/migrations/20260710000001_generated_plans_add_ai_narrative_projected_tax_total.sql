-- Stores the projectedTaxStrategyAnnualValue figure used to generate the currently-saved
-- ai_narrative, so results/page.tsx can detect when the projected long-term value mix
-- has moved enough to invalidate it (same pattern as ai_narrative_debt_total).
ALTER TABLE public.generated_plans
  ADD COLUMN IF NOT EXISTS ai_narrative_projected_tax_total numeric;

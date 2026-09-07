-- A plan must be able to tell whether its input snapshot changed after generation.
ALTER TABLE public.financial_snapshots
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.financial_snapshots
SET updated_at = COALESCE(updated_at, created_at, snapshot_date, now())
WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS trg_financial_snapshots_updated_at ON public.financial_snapshots;
CREATE TRIGGER trg_financial_snapshots_updated_at
  BEFORE UPDATE ON public.financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

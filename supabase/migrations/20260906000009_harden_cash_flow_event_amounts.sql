-- Existing zero-value rows are retained, but every new or changed event must
-- represent actual money moving in or out.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cash_flow_events_amount_positive'
      AND conrelid = 'public.cash_flow_events'::regclass
  ) THEN
    ALTER TABLE public.cash_flow_events
      ADD CONSTRAINT cash_flow_events_amount_positive CHECK (amount > 0) NOT VALID;
  END IF;
END $$;

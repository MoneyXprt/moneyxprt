CREATE TABLE public.tax_constants_by_year (
  tax_year integer PRIMARY KEY,
  section_179_heavy_vehicle_cap numeric NOT NULL CHECK (section_179_heavy_vehicle_cap > 0),
  section_179_max_deduction numeric NOT NULL CHECK (section_179_max_deduction > 0),
  section_179_phase_out_threshold numeric NOT NULL CHECK (section_179_phase_out_threshold > 0),
  section_179_complete_phase_out numeric NOT NULL CHECK (
    section_179_complete_phase_out >= section_179_phase_out_threshold
  ),
  source text NOT NULL CHECK (char_length(btrim(source)) >= 10),
  confirmed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.tax_constants_by_year ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tax constants by year"
  ON public.tax_constants_by_year FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.tax_constants_by_year FROM anon, authenticated;
GRANT SELECT ON public.tax_constants_by_year TO authenticated;

INSERT INTO public.tax_constants_by_year (
  tax_year,
  section_179_heavy_vehicle_cap,
  section_179_max_deduction,
  section_179_phase_out_threshold,
  section_179_complete_phase_out,
  source,
  confirmed_at,
  created_at,
  created_by
) VALUES (
  2026, 32000, 2560000, 4090000, 6650000,
  'CPA-confirmed 2026-09-07', now(), now(), NULL
);

CREATE OR REPLACE FUNCTION public.reject_tax_constant_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'tax_constants_by_year is insert-only; existing rows cannot be changed or deleted';
END;
$$;

CREATE TRIGGER tax_constants_by_year_reject_mutation
  BEFORE UPDATE OR DELETE ON public.tax_constants_by_year
  FOR EACH ROW EXECUTE FUNCTION public.reject_tax_constant_mutation();

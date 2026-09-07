CREATE TABLE public.section_179_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 200),
  purchase_price numeric NOT NULL CHECK (purchase_price > 0),
  placed_in_service_date date NOT NULL,
  business_use_percent numeric NOT NULL CHECK (business_use_percent > 0 AND business_use_percent <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX section_179_equipment_user_date_idx
  ON public.section_179_equipment (user_id, placed_in_service_date DESC);

ALTER TABLE public.section_179_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Section 179 equipment"
  ON public.section_179_equipment FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add own Section 179 equipment"
  ON public.section_179_equipment FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own Section 179 equipment"
  ON public.section_179_equipment FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own Section 179 equipment"
  ON public.section_179_equipment FOR DELETE USING (auth.uid() = user_id);

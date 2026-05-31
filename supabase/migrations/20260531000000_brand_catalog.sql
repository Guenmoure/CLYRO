-- Product catalog for brand kits (Pomelli-style)
CREATE TABLE IF NOT EXISTS public.brand_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text CHECK (char_length(description) <= 500),
  image_url text NOT NULL,
  category text CHECK (char_length(category) <= 80),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_brand_catalog_items_kit ON public.brand_catalog_items(brand_kit_id);
CREATE INDEX idx_brand_catalog_items_user ON public.brand_catalog_items(user_id);

ALTER TABLE public.brand_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own catalog items"
  ON public.brand_catalog_items
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CLYRO — Brand Photoshoots (Phase 4 du portage Pomelli)
--
-- Sessions de photoshoot persistantes. Une session = un upload produit +
-- un template système + N variations générées (V1 : 4). Status enum
-- compatible avec le pattern motion (pending/generating/done/error).
--
-- L'ancien `brand-photoshoot.ts` (route stateless POST /brand/photoshoot
-- qui insère dans brand_assets) reste en place pour rétro-compat. Les
-- nouvelles routes /brand/photoshoots/* utilisent cette table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_photoshoots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id    uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  mode            text NOT NULL CHECK (mode IN ('product_template', 'generate_edit')),
  input_image_url text,                            -- product photo pour product_template
  reference_urls  text[] NOT NULL DEFAULT '{}',    -- images de référence (generate_edit), max 10
  prompt          text,                            -- prompt utilisateur (generate_edit) ou custom (product_template)
  template_id     text,                            -- id du template système choisi
  aspect_ratio    text NOT NULL DEFAULT '9:16'
                  CHECK (aspect_ratio IN ('9:16', '1:1', '4:5', '16:9')),
  output_urls     text[] NOT NULL DEFAULT '{}',    -- 4 variations renvoyées par fal.ai
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'generating', 'done', 'error')),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.brand_photoshoots IS 'Sessions de photoshoot (Phase 4 portage Pomelli)';
COMMENT ON COLUMN public.brand_photoshoots.mode IS 'product_template = upload + template système ; generate_edit = prompt libre';

CREATE INDEX idx_brand_photoshoots_kit    ON public.brand_photoshoots(brand_kit_id);
CREATE INDEX idx_brand_photoshoots_user   ON public.brand_photoshoots(user_id);
CREATE INDEX idx_brand_photoshoots_status ON public.brand_photoshoots(status);

CREATE TRIGGER trigger_brand_photoshoots_updated_at
  BEFORE UPDATE ON public.brand_photoshoots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_photoshoots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_photoshoots_select_own"
  ON public.brand_photoshoots FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_photoshoots_insert_own"
  ON public.brand_photoshoots FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_photoshoots_update_own"
  ON public.brand_photoshoots FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_photoshoots_delete_own"
  ON public.brand_photoshoots FOR DELETE
  USING (user_id = auth.uid());

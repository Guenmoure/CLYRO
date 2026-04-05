-- ============================================================
-- CLYRO — Brand Assets
-- Assets générés par l'IA pour chaque Brand Kit
-- (logos, posts réseaux sociaux, bannières, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('logo', 'social_post', 'banner', 'thumbnail')),
  platform     text,  -- 'instagram_post', 'instagram_story', 'linkedin', 'twitter', etc.
  prompt       text NOT NULL,
  image_url    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.brand_assets IS 'Assets visuels générés par IA pour un Brand Kit';
COMMENT ON COLUMN public.brand_assets.type IS 'logo | social_post | banner | thumbnail';
COMMENT ON COLUMN public.brand_assets.platform IS 'Plateforme cible (instagram_post, linkedin, twitter, etc.)';

CREATE INDEX idx_brand_assets_brand_kit_id ON public.brand_assets(brand_kit_id);
CREATE INDEX idx_brand_assets_user_id      ON public.brand_assets(user_id);
CREATE INDEX idx_brand_assets_type         ON public.brand_assets(type);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_assets_select_own"
  ON public.brand_assets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_assets_insert_own"
  ON public.brand_assets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_assets_delete_own"
  ON public.brand_assets FOR DELETE
  USING (user_id = auth.uid());

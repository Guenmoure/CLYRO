-- ============================================================
-- CLYRO — Brand Kits
-- Table persistante pour les identités visuelles des créateurs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_kits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  logo_url        text,
  primary_color   text NOT NULL DEFAULT '#6366f1'
                  CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text
                  CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  font_family     text,
  is_default      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.brand_kits IS 'Identités visuelles (Brand Kits) des utilisateurs CLYRO';
COMMENT ON COLUMN public.brand_kits.is_default IS 'Sélectionné automatiquement dans les formulaires de création';

-- Index
CREATE INDEX idx_brand_kits_user_id ON public.brand_kits(user_id);

-- updated_at automatique
CREATE TRIGGER trigger_brand_kits_updated_at
  BEFORE UPDATE ON public.brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_kits_select_own"
  ON public.brand_kits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_kits_insert_own"
  ON public.brand_kits FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_kits_update_own"
  ON public.brand_kits FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "brand_kits_delete_own"
  ON public.brand_kits FOR DELETE
  USING (user_id = auth.uid());

-- ── Storage bucket for brand logos/assets ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "brand_assets_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "brand_assets_read_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'brand-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "brand_assets_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'brand-assets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

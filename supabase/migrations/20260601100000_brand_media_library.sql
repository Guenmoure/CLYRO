-- ============================================================
-- CLYRO — Brand Media Library (Phase 2 du portage Pomelli)
--
-- L'onglet « Assets » de Pomelli est une médiathèque générique d'images
-- réutilisables (vs le `brand_assets` existant qui est spécifique aux
-- assets IA-générés typés logo/social_post/banner/thumbnail).
--
-- Cette table indexe les fichiers déposés par l'utilisateur dans le
-- bucket Storage `brand-assets/<user_id>/library/...` pour permettre
-- la liste, le filtre par tag et la suppression sans scan du bucket.
--
-- Le storage bucket existe déjà (cf. migration 20260405000000_brand_kits.sql)
-- avec ses 3 policies par user_id — on ne touche pas à Storage ici.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_media_library (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id  uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  storage_path  text NOT NULL,
  -- URL signée mise en cache (1 an). NULL si jamais demandée — on la
  -- (re)génère à la volée côté API quand nécessaire.
  url           text,
  filename      text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
  mime_type     text NOT NULL CHECK (mime_type IN (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
  )),
  size_bytes    bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- ≤ 10 MB
  tags          text[] NOT NULL DEFAULT '{}',
  source_url    text,            -- URL d'origine si import via « Add from URL »
  width         integer,
  height        integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.brand_media_library IS 'Médiathèque utilisateur de la marque (Phase 2 portage Pomelli)';
COMMENT ON COLUMN public.brand_media_library.storage_path IS 'Chemin dans le bucket Storage brand-assets';

CREATE INDEX idx_brand_media_library_kit  ON public.brand_media_library(brand_kit_id);
CREATE INDEX idx_brand_media_library_user ON public.brand_media_library(user_id);
CREATE INDEX idx_brand_media_library_tags ON public.brand_media_library USING gin (tags);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.brand_media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_media_library_select_own"
  ON public.brand_media_library FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_media_library_insert_own"
  ON public.brand_media_library FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_media_library_update_own"
  ON public.brand_media_library FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_media_library_delete_own"
  ON public.brand_media_library FOR DELETE
  USING (user_id = auth.uid());

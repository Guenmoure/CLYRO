-- ============================================================
-- CLYRO — Brand Campaigns (Phase 3.1 du portage Pomelli)
--
-- 3 tables qui forment l'ossature du modèle Campagne persistant :
--   brand_campaigns           — une campagne (prompt utilisateur + DNA)
--   brand_creatives           — les créatives produites (1 image + texte
--                                par creative ; current_version pointe vers
--                                la version active dans creative_versions)
--   brand_creative_versions   — historique éditable scène par scène
--
-- L'ancien `brand-campaigns.ts` (workflow stateless ideate+generate) reste
-- en place pour rétro-compat — ce modèle persistant le double sans le
-- remplacer.
-- ============================================================

-- ── 1. brand_campaigns ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id  uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description   text CHECK (description IS NULL OR char_length(description) <= 1000),
  prompt        text NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 3000),
  product_id    uuid REFERENCES public.brand_catalog_items(id) ON DELETE SET NULL,
  asset_ids     uuid[] NOT NULL DEFAULT '{}',
  aspect_ratio  text NOT NULL DEFAULT '9:16'
                CHECK (aspect_ratio IN ('9:16', '1:1', '4:5')),
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'generating', 'done', 'error')),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brand_campaigns IS 'Campagnes marketing persistantes (Phase 3 portage Pomelli)';
COMMENT ON COLUMN public.brand_campaigns.metadata IS 'Erreurs, stats, infos de génération (jsonb libre)';

CREATE INDEX idx_brand_campaigns_kit  ON public.brand_campaigns(brand_kit_id);
CREATE INDEX idx_brand_campaigns_user ON public.brand_campaigns(user_id);
CREATE INDEX idx_brand_campaigns_status ON public.brand_campaigns(status);

CREATE TRIGGER trigger_brand_campaigns_updated_at
  BEFORE UPDATE ON public.brand_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_campaigns_select_own"
  ON public.brand_campaigns FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_campaigns_insert_own"
  ON public.brand_campaigns FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_campaigns_update_own"
  ON public.brand_campaigns FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_campaigns_delete_own"
  ON public.brand_campaigns FOR DELETE
  USING (user_id = auth.uid());

-- ── 2. brand_creatives ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brand_creatives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url       text NOT NULL,
  prompt          text,                              -- prompt fal.ai utilisé
  header_text     text CHECK (header_text     IS NULL OR char_length(header_text)     <= 200),
  description_text text CHECK (description_text IS NULL OR char_length(description_text) <= 500),
  cta_text        text CHECK (cta_text        IS NULL OR char_length(cta_text)        <= 60),
  -- Visibility par bloc ; piloté par l'éditeur Phase 3.4 (toggle œil)
  blocks_visible  jsonb NOT NULL DEFAULT '{"header":true,"description":true,"cta":true}'::jsonb,
  current_version int  NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  position        int  NOT NULL DEFAULT 0,           -- ordre d'affichage dans la campagne
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brand_creatives IS 'Créatives (image + text overlay) d''une campagne';
COMMENT ON COLUMN public.brand_creatives.current_version IS 'Pointe vers la dernière brand_creative_versions.version_num';
COMMENT ON COLUMN public.brand_creatives.blocks_visible IS 'JSON {header, description, cta} de booléens — toggle d''affichage par bloc';

CREATE INDEX idx_brand_creatives_campaign ON public.brand_creatives(campaign_id);
CREATE INDEX idx_brand_creatives_user     ON public.brand_creatives(user_id);

CREATE TRIGGER trigger_brand_creatives_updated_at
  BEFORE UPDATE ON public.brand_creatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brand_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_creatives_select_own"
  ON public.brand_creatives FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_creatives_insert_own"
  ON public.brand_creatives FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_creatives_update_own"
  ON public.brand_creatives FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_creatives_delete_own"
  ON public.brand_creatives FOR DELETE
  USING (user_id = auth.uid());

-- ── 3. brand_creative_versions ────────────────────────────────────────────────
-- Snapshot complet d'une créative à un instant donné. Permet de revenir en
-- arrière depuis l'éditeur (Phase 3.4). Une version par modification "save",
-- jamais d'UPDATE — append-only.
CREATE TABLE IF NOT EXISTS public.brand_creative_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id  uuid NOT NULL REFERENCES public.brand_creatives(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version_num  int  NOT NULL CHECK (version_num >= 1),
  snapshot     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creative_id, version_num)
);

COMMENT ON TABLE public.brand_creative_versions IS 'Historique append-only des éditions de créatives';

CREATE INDEX idx_brand_creative_versions_creative ON public.brand_creative_versions(creative_id);
CREATE INDEX idx_brand_creative_versions_user     ON public.brand_creative_versions(user_id);

ALTER TABLE public.brand_creative_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_creative_versions_select_own"
  ON public.brand_creative_versions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_creative_versions_insert_own"
  ON public.brand_creative_versions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Pas d'UPDATE ni de DELETE — append-only par design.

-- ============================================================
-- CLYRO — Brand Kits : extension Business DNA (Pomelli-inspired)
--
-- Étend la table public.brand_kits avec les champs « Business DNA »
-- qui alimenteront tout le module Brand Kit (Catalog, Assets,
-- Campaigns, Photoshoot, Brand Book) et enrichiront les prompts
-- Claude des pipelines vidéo existants (Motion / Motion Design /
-- Faceless) pour produire du contenu réellement on-brand.
--
-- Tous les nouveaux champs ont un défaut ou sont NULLable : les
-- lignes existantes restent valides après application sans aucune
-- mise à jour. Les RLS existantes (4 policies par user_id =
-- auth.uid()) couvrent automatiquement les nouvelles colonnes.
-- ============================================================

ALTER TABLE public.brand_kits
  -- ── Brand Overview (Pomelli onglet 1) ──────────────────────────
  ADD COLUMN IF NOT EXISTS url                  text,
  ADD COLUMN IF NOT EXISTS tagline              text
    CHECK (tagline IS NULL OR char_length(tagline) <= 200),
  ADD COLUMN IF NOT EXISTS brand_values         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_aesthetic      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_tone_of_voice  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_overview    text
    CHECK (business_overview IS NULL OR char_length(business_overview) <= 2000),

  -- ── Business Details (Pomelli onglet 2) ────────────────────────
  ADD COLUMN IF NOT EXISTS location             text,
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS business_hours       text,
  ADD COLUMN IF NOT EXISTS keywords             text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links         jsonb  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_links            jsonb  NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS testimonials         text
    CHECK (testimonials IS NULL OR char_length(testimonials) <= 4000);

COMMENT ON COLUMN public.brand_kits.url IS                 'Site web de la marque';
COMMENT ON COLUMN public.brand_kits.tagline IS             'Tagline courte (≤200 char)';
COMMENT ON COLUMN public.brand_kits.brand_values IS        'Valeurs de marque (tags)';
COMMENT ON COLUMN public.brand_kits.brand_aesthetic IS     'Mots-clés esthétique visuelle';
COMMENT ON COLUMN public.brand_kits.brand_tone_of_voice IS 'Descripteurs du ton';
COMMENT ON COLUMN public.brand_kits.business_overview IS   'Description libre (≤2000 char)';
COMMENT ON COLUMN public.brand_kits.location IS            'Localisation (ville, pays, etc.)';
COMMENT ON COLUMN public.brand_kits.phone IS               'Téléphone affiché';
COMMENT ON COLUMN public.brand_kits.business_hours IS      'Horaires d''ouverture';
COMMENT ON COLUMN public.brand_kits.keywords IS            'Mots-clés SEO / catégorisation';
COMMENT ON COLUMN public.brand_kits.social_links IS        'JSON {facebook?, instagram?, linkedin?, twitter?, youtube?, tiktok?, pinterest?}';
COMMENT ON COLUMN public.brand_kits.cta_links IS           'JSON array [{label, url}]';
COMMENT ON COLUMN public.brand_kits.testimonials IS        'Témoignages clients (≤4000 char)';

-- ============================================================
-- CLYRO — Brand creatives : positions libres + tailles (Phase 3.4 V2)
--
-- Ajoute deux colonnes jsonb à brand_creatives pour stocker les
-- coordonnées libres de chaque bloc de text overlay (header, description,
-- cta) ainsi que leur multiplicateur de taille de police. Les valeurs
-- NULL signifient « positions et tailles par défaut » (presets V1).
--
-- block_positions : { header: {x:50, y:5}, description: {x:50, y:50},
--                     cta: {x:50, y:90} }  // x,y en pourcent du preview
-- block_sizes     : { header: 1.2, description: 1.0, cta: 1.0 }
--                   // facteur multiplicatif sur la taille de police par défaut
--
-- Les RLS existantes sur brand_creatives couvrent automatiquement ces
-- nouvelles colonnes.
-- ============================================================

ALTER TABLE public.brand_creatives
  ADD COLUMN IF NOT EXISTS block_positions jsonb,
  ADD COLUMN IF NOT EXISTS block_sizes     jsonb;

COMMENT ON COLUMN public.brand_creatives.block_positions IS
  'Coordonnées x,y (en %) du centre de chaque bloc : {header, description, cta}. NULL = presets V1.';
COMMENT ON COLUMN public.brand_creatives.block_sizes IS
  'Multiplicateur de taille de police par bloc : {header, description, cta}. NULL = 1.0 partout.';

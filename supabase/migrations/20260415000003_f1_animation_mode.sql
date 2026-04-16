-- ============================================================
-- CLYRO — F1 Animation Mode
-- Ajoute le choix du mode d'animation (Storyboard / Fast / Pro)
-- sur les projets et les scènes Faceless.
-- ============================================================

-- Mode global du projet et overrides par scène
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS animation_mode text
    DEFAULT 'storyboard'
    CHECK (animation_mode IN ('storyboard', 'fast', 'pro')),
  ADD COLUMN IF NOT EXISTS animation_overrides jsonb
    DEFAULT '{}'::jsonb;
    -- { "scene_index": "storyboard"|"fast"|"pro" }

-- Mode effectif + info clip sur chaque scène (stocké dans metadata.scenes)
-- Note: les scènes sont dans metadata JSONB — pas de table scenes séparée.
-- Ces colonnes sont ajoutées sur la table videos pour le mode global uniquement.

COMMENT ON COLUMN videos.animation_mode IS
  'Mode d''animation global: storyboard (Ken Burns), fast (Wan 5s), pro (Kling 8s)';

COMMENT ON COLUMN videos.animation_overrides IS
  'Overrides par index de scène: { "0": "pro", "3": "storyboard" }';

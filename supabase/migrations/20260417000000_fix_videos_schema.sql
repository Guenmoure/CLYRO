-- ─────────────────────────────────────────────────────────────────────────────
-- Fix videos table schema so the Projects page can load and display videos
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add columns that the projects/dashboard pages query but were never created
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS thumbnail_url    text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS created_by       text;

-- 2. Extend module CHECK to include brand and studio
--    (draft system saves 'brand' and 'studio' — blocked by original constraint)
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_module_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_module_check
  CHECK (module IN ('faceless', 'motion', 'brand', 'studio'));

-- 3. Extend status CHECK to include all pipeline stages
--    (original only had a subset; 'animation' was missing which caused insert failures)
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_status_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_status_check
  CHECK (status IN (
    'draft', 'pending', 'processing',
    'storyboard', 'visuals', 'audio', 'animation', 'assembly',
    'done', 'error'
  ));

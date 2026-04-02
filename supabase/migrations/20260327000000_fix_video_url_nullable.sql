-- ============================================================
-- MIGRATION: Fix legacy video_url column
-- The videos table has a legacy `video_url` column (NOT NULL)
-- that is no longer used in the codebase — all code uses `output_url`.
-- This migration makes video_url nullable so that INSERTs succeed
-- without providing it.
-- ============================================================

-- Make video_url nullable (was NOT NULL with no default)
ALTER TABLE public.videos ALTER COLUMN video_url DROP NOT NULL;

-- Optional: set an empty string default for safety
ALTER TABLE public.videos ALTER COLUMN video_url SET DEFAULT '';

COMMENT ON COLUMN public.videos.video_url IS 'Legacy column — deprecated. Use output_url instead.';

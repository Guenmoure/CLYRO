-- ============================================================
-- CLYRO — Sync production videos schema
-- Run this once in Supabase → SQL Editor (project: wubtpnybgvuocgvsjbbn).
-- Every statement is idempotent (IF NOT EXISTS / DROP IF EXISTS)
-- so re-running is safe.
-- ============================================================

-- ── 1) Draft system columns (from 20260415000004_draft_system.sql) ──
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS wizard_step      integer     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wizard_state     jsonb       DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz;

-- ── 2) Dashboard columns (from 20260417000000_fix_videos_schema.sql) ──
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS thumbnail_url    text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS created_by       text;

-- ── 3) module CHECK — accept brand + studio ──
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_module_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_module_check
  CHECK (module IN ('faceless', 'motion', 'brand', 'studio'));

-- ── 4) status CHECK — accept draft + full pipeline ──
ALTER TABLE public.videos
  DROP CONSTRAINT IF EXISTS videos_status_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_status_check
  CHECK (status IN (
    'draft', 'pending', 'processing',
    'storyboard', 'visuals', 'audio', 'animation', 'assembly',
    'done', 'error'
  ));

-- ── 5) Draft index ──
CREATE INDEX IF NOT EXISTS idx_videos_drafts
  ON public.videos(user_id, updated_at DESC)
  WHERE status = 'draft';

-- ── 6) Cleanup function for expired drafts ──
CREATE OR REPLACE FUNCTION public.cleanup_expired_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.videos
  WHERE  status = 'draft'
    AND  draft_expires_at IS NOT NULL
    AND  draft_expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_drafts IS
  'Deletes expired wizard drafts. Call from a scheduled cron job.';

-- ── 7) Quick sanity check — should list every column above ──
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='videos'
--   ORDER BY ordinal_position;

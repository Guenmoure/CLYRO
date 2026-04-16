-- ============================================================
-- CLYRO — Draft system
-- Adds wizard draft persistence columns to the videos table
-- ============================================================

-- ── Draft columns ─────────────────────────────────────────────
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS wizard_step      integer     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wizard_state     jsonb       DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS draft_expires_at timestamptz;

-- ── Extend status CHECK to include 'draft' ────────────────────
-- Drop existing inline constraint (auto-named by Postgres)
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;

-- Recreate with 'draft' added
ALTER TABLE public.videos ADD CONSTRAINT videos_status_check
  CHECK (status IN (
    'draft', 'pending', 'processing', 'storyboard',
    'visuals', 'audio', 'assembly', 'done', 'error'
  ));

-- ── Index for fast draft lookup per user ──────────────────────
CREATE INDEX IF NOT EXISTS idx_videos_drafts
  ON public.videos(user_id, updated_at DESC)
  WHERE status = 'draft';

-- ── RLS policy: users can insert/select/update/delete own drafts ─
-- (existing policies on videos already cover owner access, but
--  adding explicit SELECT for drafts just in case)

-- ── Cleanup function ──────────────────────────────────────────
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

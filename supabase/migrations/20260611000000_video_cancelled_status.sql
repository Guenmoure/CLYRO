-- ============================================================
-- CLYRO — 'cancelled' video status
--
-- Adds the 'cancelled' value to the videos.status CHECK constraint so
-- the new POST /api/v1/videos/:id/cancel route (apps/api) can mark an
-- in-flight generation as cancelled by the user.
--
-- 'cancelled' is a TERMINAL state, like 'done' and 'error':
--   * The SSE status stream closes on it.
--   * The pipeline cooperates via assertNotCancelled() between major
--     steps and aborts without marking 'error' or refunding (the cancel
--     route already issued the idempotent refund — see migration
--     20260610000000_idempotent_refunds.sql).
-- ============================================================

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_status_check
  CHECK (status IN (
    -- Canonical values (new writes — see packages/shared/src/types/video.ts)
    'draft', 'generating', 'done', 'error',
    -- User-initiated cancellation (terminal, refunded)
    'cancelled',
    -- Legacy values still present in older rows / readers
    'pending', 'processing',
    'storyboard', 'visuals', 'audio', 'animation', 'assembly',
    'completed'
  ));

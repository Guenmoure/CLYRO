-- ─────────────────────────────────────────────────────────────────────────────
-- Add 'generating' to videos.status CHECK constraint
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Context: commit 01532f2 ("feat(drafts): clean lifecycle — armed draft +
-- 4-value status enum") unified the status enum to 4 canonical values
-- (draft, generating, done, error) in TypeScript and switched every pipeline
-- route's INSERT/UPDATE from `status: 'pending'` to `status: 'generating'`.
-- The Postgres CHECK constraint was NOT updated in lockstep, so every
-- INSERT into public.videos with status='generating' was failing with
-- `videos_status_check` violation, surfacing as "Failed to create video"
-- (apps/api/src/routes/pipeline/{faceless,motion}.ts:DB_ERROR) on the
-- frontend toast.
--
-- This migration extends the CHECK to accept BOTH the new canonical value
-- and all legacy values still present in production rows (no data loss,
-- no row rewrites — the constraint just admits more values).

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_status_check;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_status_check
  CHECK (status IN (
    -- 4 canonical values (new writes — see packages/shared/src/types/video.ts)
    'draft', 'generating', 'done', 'error',
    -- Legacy values still present in older rows / readers
    'pending', 'processing',
    'storyboard', 'visuals', 'audio', 'animation', 'assembly',
    'completed'
  ));

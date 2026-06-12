-- ============================================================
-- CLYRO — Make 'studio-videos' and 'yt-audio' buckets PRIVATE
--
-- Both buckets were created public-read:
--   * studio-videos (20260418000001) — "URL contains the project UUID"
--     was the only protection. UUIDs leak via logs, Referer headers and
--     DB rows, so public-read is not an access control.
--   * yt-audio (20260419000002) — temporary audio for fal.ai Whisper.
--     fal.ai only needs an HTTP GET, which a signed URL provides.
--
-- This migration flips both buckets to private and removes the public
-- SELECT policies. Access paths after this migration:
--   * Backend (service role) — bypasses RLS, uploads/deletes unchanged.
--   * Frontend playback of studio videos — the backend now persists
--     SIGNED urls (created via service role; signed URLs work on
--     private buckets independently of RLS policies).
--   * fal.ai Whisper — fetches a short-lived signed URL (1 h).
--   * Authenticated owners can also read their own studio files
--     directly thanks to the owner-scoped SELECT policy below
--     (pattern mirrors the private 'videos' bucket in
--     20260321000002_storage_buckets.sql, adapted because
--     studio-videos paths are keyed by project id, not user id).
-- ============================================================

-- ── 1. Flip both buckets to private ───────────────────────────────
UPDATE storage.buckets SET public = false WHERE id IN ('studio-videos', 'yt-audio');

-- ── 2. Drop the public-read policies ──────────────────────────────
DROP POLICY IF EXISTS "studio_videos_storage_select_public" ON storage.objects;
DROP POLICY IF EXISTS "yt_audio_storage_select_public"      ON storage.objects;

-- ── 3. studio-videos: owner-only SELECT ───────────────────────────
-- Path structure: {project_id}/final-{format}-{ts}.mp4 (and
-- {project_id}/scene-*.mp4). The first folder segment is the
-- studio_projects id, so ownership is resolved through that table
-- (which has its own auth.uid() = user_id RLS).
DROP POLICY IF EXISTS "studio_videos_storage_select_own" ON storage.objects;
CREATE POLICY "studio_videos_storage_select_own"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'studio-videos' AND
    EXISTS (
      SELECT 1
      FROM public.studio_projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.user_id = auth.uid()
    )
  );

-- ── 4. yt-audio: NO user-level policy at all ──────────────────────
-- Files are uploaded by the backend (service role), fetched once by
-- fal.ai through a short-lived signed URL, then deleted. No user ever
-- needs direct access, so the absence of a SELECT policy is the
-- correct (deny-by-default) configuration. Writes were already
-- service-role-only (no INSERT policy existed).

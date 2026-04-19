-- F5-011 fix: dedicated storage bucket for assembled studio videos.
-- Path structure: {project_id}/final-{format}-{ts}.mp4

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'studio-videos',
  'studio-videos',
  true,                                       -- public: playback via <video src> from the UI
  524288000,                                  -- 500 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Read: anyone (bucket is public; the URL itself contains the project UUID,
-- which is only leaked to the project owner via studio_projects RLS).
CREATE POLICY "studio_videos_storage_select_public"
  ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'studio-videos' );

-- Insert/update/delete: only via the service role (backend). No user-level
-- write policy is defined, which means the anon/authenticated roles cannot
-- upload anything — uploads go through supabaseAdmin (service role) from
-- apps/api/src/routes/pipeline/studio.ts → runStudioFinalRender().

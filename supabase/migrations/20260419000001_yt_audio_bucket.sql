-- F5 Studio — YouTube transcription requires a temporary audio bucket to
-- host extracted mp3 files long enough for fal.ai Whisper to fetch them.
-- Files are uploaded by the backend (service role) and deleted right after
-- transcription completes. Public read so fal.ai can fetch via plain URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'yt-audio',
  'yt-audio',
  true,                                       -- public: fal.ai fetches by URL
  104857600,                                  -- 100 MB (YouTube audio @128kbps is ~60 MB for 60 min)
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Read: anyone (bucket is public; URLs are random uuids, no enumeration risk).
DROP POLICY IF EXISTS "yt_audio_storage_select_public" ON storage.objects;
CREATE POLICY "yt_audio_storage_select_public"
  ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'yt-audio' );

-- Insert/update/delete: only via service role (backend). No user-level write
-- policy → anon/authenticated cannot upload. Uploads go through supabaseAdmin
-- from apps/api/src/services/transcribe.ts → extractYouTubeAudio().

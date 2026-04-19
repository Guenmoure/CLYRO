-- F5 Studio: allow audio files in studio-videos bucket.
-- The ElevenLabs pre-generation pipeline uploads audio/mpeg files to this
-- bucket before passing a signed URL to HeyGen type:'audio'. Without this,
-- Supabase rejects the upload and the pipeline falls back to HeyGen TTS
-- with an ElevenLabs voice ID, causing "HeyGen reported failure".

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav'
]
WHERE id = 'studio-videos';

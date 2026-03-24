-- ============================================================
-- CLYRO — Storage Buckets + Politiques de sécurité
-- ============================================================

-- ── Créer les buckets ─────────────────────────────────────────

-- videos/ — Vidéos MP4 générées
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  false,  -- privé — accès via signed URLs uniquement
  524288000,  -- 500 MB max
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- voice-samples/ — Échantillons audio pour clonage vocal
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-samples',
  'voice-samples',
  false,  -- privé
  52428800,  -- 50 MB max
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

-- brand-assets/ — Logos et assets marque pour Motion Graphics
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  false,  -- privé
  10485760,  -- 10 MB max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- POLITIQUES STORAGE : videos/
-- Structure : {user_id}/{video_id}/output.mp4
-- ============================================================

-- Lecture : seulement ses propres vidéos
CREATE POLICY "videos_storage_select_own"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Insertion : seulement dans son propre dossier
CREATE POLICY "videos_storage_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Mise à jour : seulement ses propres fichiers
CREATE POLICY "videos_storage_update_own"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Suppression : seulement ses propres fichiers
CREATE POLICY "videos_storage_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- POLITIQUES STORAGE : voice-samples/
-- Structure : {user_id}/{voice_id}.mp3
-- ============================================================

CREATE POLICY "voice_samples_storage_select_own"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'voice-samples' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "voice_samples_storage_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-samples' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "voice_samples_storage_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'voice-samples' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- POLITIQUES STORAGE : brand-assets/
-- Structure : {user_id}/{project_id}/logo.png
-- ============================================================

CREATE POLICY "brand_assets_storage_select_own"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'brand-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "brand_assets_storage_insert_own"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'brand-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "brand_assets_storage_delete_own"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'brand-assets' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

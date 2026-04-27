-- ============================================================
-- CLYRO — Folders system for the projects library.
-- Lets users group videos into named folders. Implements the
-- "Move" action that was previously a placeholder in the UI.
--
-- Design notes:
--   * folder_id on videos is nullable (= "Unfiled / All projects")
--   * ON DELETE SET NULL: deleting a folder doesn't delete the videos
--     it contained — they just become unfiled.
--   * Names unique per (user_id, lower(name)) to keep the picker
--     unambiguous.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.folders IS
  'User-owned folders for organizing the videos library.';
COMMENT ON COLUMN public.folders.name IS
  'Display name shown in the sidebar and the move picker.';

-- Case-insensitive unique name per user (so "Travel" and "travel"
-- can't both exist for the same user — confusing in the picker).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_folders_user_lower_name
  ON public.folders (user_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_folders_user_id
  ON public.folders (user_id);

-- updated_at trigger (set_updated_at() defined in initial schema)
DROP TRIGGER IF EXISTS trigger_folders_updated_at ON public.folders;
CREATE TRIGGER trigger_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "folders_select_own" ON public.folders;
CREATE POLICY "folders_select_own"
  ON public.folders FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_insert_own" ON public.folders;
CREATE POLICY "folders_insert_own"
  ON public.folders FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_update_own" ON public.folders;
CREATE POLICY "folders_update_own"
  ON public.folders FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "folders_delete_own" ON public.folders;
CREATE POLICY "folders_delete_own"
  ON public.folders FOR DELETE
  USING (user_id = auth.uid());

-- ── Videos: add folder_id ──────────────────────────────────────
-- Nullable on purpose: NULL = "no folder / All projects".
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS folder_id uuid
  REFERENCES public.folders(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.videos.folder_id IS
  'Optional folder grouping. NULL = unfiled.';

CREATE INDEX IF NOT EXISTS idx_videos_folder_id
  ON public.videos (folder_id);

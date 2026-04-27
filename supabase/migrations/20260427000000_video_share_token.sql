-- ============================================================
-- CLYRO — Public share links for videos.
-- Implements the "Collaborate" / "Share" action from the project
-- card menu: a video gets an opaque token that anyone with the URL
-- can use to view (read-only). Owners can rotate or revoke the token.
--
-- Design notes:
--   * share_token is a uuid (opaque, unguessable, 122 bits of entropy)
--   * NULL = not shared / private (default for all existing rows)
--   * Anon does NOT get RLS access to the videos table. The public
--     /share/[token] page resolves the token server-side via a
--     SECURITY DEFINER function (resolve_shared_video) that returns
--     ONLY the columns safe for public consumption and ONLY when the
--     token matches. This avoids any risk of anon enumerating shared
--     rows by querying the table directly.
-- ============================================================

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS share_token uuid;

COMMENT ON COLUMN public.videos.share_token IS
  'Opaque token for public read-only sharing. NULL = private. Set/revoked via /api/videos/:id/share.';

-- Unique partial index: enforce no two videos share the same token,
-- but only for rows where the token is set (NULL is allowed many times).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_videos_share_token
  ON public.videos (share_token)
  WHERE share_token IS NOT NULL;

-- ── Public resolver function ─────────────────────────────────────────
-- Returns the safe-for-public projection of a single video, identified
-- by its share token. SECURITY DEFINER bypasses RLS, but the function
-- body filters on the exact token, so callers can only get back the
-- one video they already have a link to. STABLE since it doesn't write.

CREATE OR REPLACE FUNCTION public.resolve_shared_video(p_token uuid)
RETURNS TABLE (
  id          uuid,
  title       text,
  module      text,
  output_url  text,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.title,
    v.module,
    v.output_url,
    v.created_at
  FROM public.videos v
  WHERE v.share_token = p_token
    AND v.share_token IS NOT NULL
  LIMIT 1;
$$;

-- Allow the anon role to call the resolver. The function itself does
-- the access control — it only ever returns the matching row.
REVOKE ALL ON FUNCTION public.resolve_shared_video(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_shared_video(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.resolve_shared_video(uuid) IS
  'Public resolver for /share/[token]. Returns one video by its share token, or 0 rows if revoked.';

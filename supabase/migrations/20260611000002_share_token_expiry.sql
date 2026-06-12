-- ============================================================
-- CLYRO — Share link expiry
--
-- Adds an optional expiry to public share links:
--   * videos.share_token_expires_at — NULL = never expires (legacy
--     behaviour for all existing rows), otherwise the instant after
--     which the link stops resolving.
--   * resolve_shared_video() now returns 0 rows for expired tokens,
--     so the public /share/[token] page falls through to notFound()
--     exactly like a revoked/unknown token.
--
-- The expiry is set by POST /api/videos/:id/share (apps/web) when a
-- token is minted or rotated: now() + expiresInDays (Zod 1-365,
-- default 30).
-- ============================================================

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS share_token_expires_at timestamptz;

COMMENT ON COLUMN public.videos.share_token_expires_at IS
  'Expiry of share_token. NULL = no expiry. Expired tokens resolve to 0 rows in resolve_shared_video().';

-- ── Resolver: filter out expired tokens ──────────────────────────────
-- Same signature/projection as 20260427000000 — only the WHERE clause
-- gains the expiry condition. STABLE is still correct (now() is stable
-- within a statement).
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
    AND (v.share_token_expires_at IS NULL OR v.share_token_expires_at > now())
  LIMIT 1;
$$;

-- Re-assert permissions (CREATE OR REPLACE keeps grants, but stay explicit).
REVOKE ALL ON FUNCTION public.resolve_shared_video(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolve_shared_video(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.resolve_shared_video(uuid) IS
  'Public resolver for /share/[token]. Returns one video by its share token, or 0 rows if revoked or expired.';

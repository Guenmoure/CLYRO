-- ============================================================
-- CLYRO — Add WITH CHECK to UPDATE policies
--
-- security.md rule: every UPDATE/INSERT policy MUST include a
-- WITH CHECK clause. Without it, a user can UPDATE one of their own
-- rows and re-point user_id at another user's id (USING only guards
-- the OLD row, WITH CHECK guards the NEW row).
--
-- Affected policies (created without WITH CHECK):
--   - brand_kits_update_own       (20260405000000_brand_kits.sql)
--   - folders_update_own          (20260426000000_folders.sql)
--   - autopilot_update_own        (20260424000000_autopilot_series.sql)
-- ============================================================

-- ── brand_kits ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "brand_kits_update_own" ON public.brand_kits;
CREATE POLICY "brand_kits_update_own"
  ON public.brand_kits FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── folders ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "folders_update_own" ON public.folders;
CREATE POLICY "folders_update_own"
  ON public.folders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── autopilot_series ────────────────────────────────────────────────
DROP POLICY IF EXISTS "autopilot_update_own" ON public.autopilot_series;
CREATE POLICY "autopilot_update_own"
  ON public.autopilot_series FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

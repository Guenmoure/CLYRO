-- Restore public.profiles.updated_at column after an out-of-band DROP COLUMN.
--
-- Context: the column was defined in 20260321000000_initial_schema.sql
-- (timestamptz NOT NULL DEFAULT now()) with a BEFORE UPDATE trigger
-- (trigger_profiles_updated_at) that refreshes it via public.set_updated_at().
-- The column was later dropped directly against the remote database, which
-- left the trigger referencing a missing column — any UPDATE on profiles
-- would raise "column NEW.updated_at does not exist".
--
-- 20260418000000_fix_initial_credits_250.sql wrapped its credit backfill in
-- an EXCEPTION block specifically to survive that broken state. This
-- migration makes the schema consistent again and runs the deferred
-- backfill.

-- ── 1) Add the column back (idempotent) ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.updated_at IS
  'Auto-refreshed by trigger_profiles_updated_at on every UPDATE.';

-- ── 2) Re-create the trigger function (no-op if already present) ──────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3) Re-create the trigger (drop-if-exists for idempotency) ─────────────
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4) Deferred backfill from the previous migration ──────────────────────
-- Now that the schema is consistent, the UPDATE that was swallowed by the
-- EXCEPTION block in 20260418000000_fix_initial_credits_250.sql can run.
UPDATE public.profiles
   SET credits = 250
 WHERE plan = 'free'
   AND credits = 3;

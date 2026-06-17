-- ─────────────────────────────────────────────────────────────────────────────
-- 20260616000000 · profile_internal_unlimited
--
-- Adds an operational flag to mark an individual account as « unlimited »
-- WITHOUT introducing a new plan tier visible in pricing. Use it for:
--   • internal test / staging accounts that need to exercise paid flows
--     without burning real credits,
--   • support overrides (« the user lost a render to a 5xx, give them
--     temporary unlimited for 24 h while we debug »),
--   • enterprise accounts negotiated outside the public price grid.
--
-- The credits service (apps/api/src/services/credits.ts) reads this flag
-- and fast-paths `deductCredits()` to a no-op when it's true — same code
-- path as `isUnlimitedPlan(plan)`. The frontend (apps/web/hooks/use-credits.ts)
-- merges it into the `isUnlimited` boolean it exposes.
--
-- RLS NOTE: the existing « profiles select own row » policy is sufficient —
-- a user can read their OWN flag, no other user's. UPDATE is restricted to
-- the existing policy so a user CANNOT self-promote to unlimited via a
-- client write. Only the service-role key (server-side) can flip the bit.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS internal_unlimited boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.internal_unlimited IS
  'When true, credit deductions are no-op for this user. Operational flag, not a plan.';

-- Partial index — most rows are false, so a small index makes the
-- « list all internal unlimited accounts » query (operations dashboards,
-- billing reconciliation) cheap without paying for full coverage.
CREATE INDEX IF NOT EXISTS idx_profiles_internal_unlimited
  ON public.profiles(id)
  WHERE internal_unlimited = true;

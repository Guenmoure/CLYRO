-- ============================================================
-- CLYRO — Credits system overhaul
--
-- Goals:
--   1. Add Pro and Creator plans (DB only knew free/starter/studio).
--   2. Track each user's monthly_credits quota and last renewal date.
--   3. Add a credit_ledger table for full audit trail (every grant,
--      consume, topup, refund, renewal is logged).
--   4. Provide atomic SECURITY DEFINER RPCs that the API calls:
--        - consume_credits()    : check + decrement + log in one tx
--        - grant_credits()      : increment + log
--        - renew_subscription_credits() : monthly cron entry point,
--          adds the plan's monthly quota to the balance (roll-over,
--          per the /pricing page promise — credits never expire).
--   5. Update handle_new_user() to seed monthly_credits=250 (Free plan).
--
-- The API NEVER mutates profiles.credits directly anymore — only
-- through these RPCs, so the ledger stays consistent.
-- ============================================================

-- ── 1. Extend the plan CHECK constraint to all 5 plans ─────────────
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'pro', 'creator', 'studio'));

-- ── 2. monthly_credits + subscription_renewed_at columns ───────────
-- monthly_credits = the quota for the user's CURRENT plan (display
--   in CreditsBanner, used by renew RPC). Defaults to 250 (Free).
-- subscription_renewed_at = last time we credited the monthly quota.
--   Used by the renew RPC to know who is due.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_credits integer NOT NULL DEFAULT 250
    CHECK (monthly_credits >= 0);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_renewed_at timestamptz;

COMMENT ON COLUMN public.profiles.monthly_credits IS
  'Monthly quota for the current plan (free=250, starter=800, pro=3000, creator=9000, studio=25000).';
COMMENT ON COLUMN public.profiles.subscription_renewed_at IS
  'Last time monthly_credits were granted to this user. NULL for never-renewed (Free plan).';

-- Index used by the renewal cron to find due users.
CREATE INDEX IF NOT EXISTS idx_profiles_renewal_due
  ON public.profiles (subscription_renewed_at)
  WHERE plan <> 'free';

-- ── 3. credit_ledger table ─────────────────────────────────────────
-- Append-only audit trail. balance_after stored for fast "what was
-- the balance at time T" queries without replaying the full ledger.

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN (
                  'signup_grant',     -- one-time signup bonus (250 free)
                  'subscription',     -- monthly plan renewal (roll-over)
                  'topup',            -- one-shot credit pack purchase
                  'consume',          -- video generation cost (negative amount)
                  'refund',           -- pipeline error refund (positive amount)
                  'admin_grant'       -- manual credit by admin / support
                )),
  amount        integer NOT NULL,    -- positive = credit, negative = debit
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  source        text,                -- e.g. video id, stripe session id, topup pack id
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.credit_ledger IS
  'Append-only audit trail of every credit movement. Source of truth for billing disputes.';

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id
  ON public.credit_ledger (user_id, created_at DESC);

-- ── RLS on credit_ledger ───────────────────────────────────────────
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_ledger_select_own" ON public.credit_ledger;
CREATE POLICY "credit_ledger_select_own"
  ON public.credit_ledger FOR SELECT
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER RPCs
-- (running with elevated privileges) can write to the ledger.

-- ── 4. Atomic RPCs ─────────────────────────────────────────────────

-- consume_credits(): returns the new balance, or raises if insufficient.
-- The single UPDATE+RETURNING is atomic so two concurrent generations
-- can't both succeed when only one credit's worth is left.

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id  uuid,
  p_amount   integer,
  p_source   text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'consume_credits: amount must be positive (got %)', p_amount
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET credits = credits - p_amount,
         updated_at = now()
   WHERE id = p_user_id
     AND credits >= p_amount
   RETURNING credits INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: user % needs % credits', p_user_id, p_amount
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_ledger (user_id, type, amount, balance_after, source, metadata)
  VALUES (p_user_id, 'consume', -p_amount, v_new_balance, p_source, p_metadata);

  RETURN v_new_balance;
END;
$$;

-- grant_credits(): increment + log. Used by signup grant, subscription
-- renewal, top-ups, admin grants, and refunds (where p_type='refund').

CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id  uuid,
  p_amount   integer,
  p_type     text,
  p_source   text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'grant_credits: amount must be positive (got %)', p_amount
      USING ERRCODE = '22023';
  END IF;

  IF p_type NOT IN ('signup_grant','subscription','topup','refund','admin_grant') THEN
    RAISE EXCEPTION 'grant_credits: invalid type "%"', p_type
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET credits = credits + p_amount,
         updated_at = now()
   WHERE id = p_user_id
   RETURNING credits INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'grant_credits: profile % not found', p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.credit_ledger (user_id, type, amount, balance_after, source, metadata)
  VALUES (p_user_id, p_type, p_amount, v_new_balance, p_source, p_metadata);

  RETURN v_new_balance;
END;
$$;

-- renew_subscription_credits(): cron entry point. Picks every paid-plan
-- user whose subscription_renewed_at is NULL or older than 30 days and
-- credits them with their plan's monthly quota. Roll-over by design:
-- we ADD to the existing balance, never reset.
--
-- Returns the number of users renewed. Safe to run multiple times per
-- day: the 30-day window means each user only renews once per cycle.

CREATE OR REPLACE FUNCTION public.renew_subscription_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_count integer := 0;
BEGIN
  FOR v_user IN
    SELECT id, plan, monthly_credits
      FROM public.profiles
     WHERE plan <> 'free'
       AND monthly_credits > 0
       AND (subscription_renewed_at IS NULL
            OR subscription_renewed_at < now() - interval '30 days')
  LOOP
    PERFORM public.grant_credits(
      v_user.id,
      v_user.monthly_credits,
      'subscription',
      v_user.plan,
      jsonb_build_object('reason', 'monthly_renewal')
    );

    UPDATE public.profiles
       SET subscription_renewed_at = now()
     WHERE id = v_user.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 5. Update handle_new_user trigger ──────────────────────────────
-- Seed monthly_credits=250 (Free plan) and log the signup grant.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, plan, credits, monthly_credits)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'free',
    250,
    250
  )
  ON CONFLICT (id) DO NOTHING;

  -- Log the signup grant in the ledger (best-effort — wrap in BEGIN/EXCEPTION
  -- so a ledger failure never blocks signup).
  BEGIN
    INSERT INTO public.credit_ledger (user_id, type, amount, balance_after, source, metadata)
    VALUES (NEW.id, 'signup_grant', 250, 250, 'free_plan_signup', '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    -- ledger insert failed but profile was created — surface a warning, don't fail signup
    RAISE WARNING 'credit_ledger insert failed for new user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Re-create the trigger so the new function body takes effect.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 6. Permissions ─────────────────────────────────────────────────
-- The 3 RPCs are SECURITY DEFINER but we still gate EXECUTE so anon
-- can't drain a user's wallet by guessing UUIDs. Only authenticated
-- (the user themselves, via API) and service_role can call them.

REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, jsonb)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, text, jsonb)
  TO service_role;
-- Note: grant_credits is service_role-only. Authenticated users must
-- never grant themselves credits. The signup grant happens via the
-- trigger; subscription/topup grants happen via webhooks (server-side).

REVOKE ALL ON FUNCTION public.renew_subscription_credits() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.renew_subscription_credits()
  TO service_role;

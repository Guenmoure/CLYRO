-- ============================================================
-- CLYRO — Idempotent refunds
--
-- Problem: a pipeline failure can trigger BOTH the watchdog timeout
-- refund AND the catch-block refund for the same video, double-crediting
-- the user. The refund `source` is always `video:<uuid>`, so we can
-- enforce at-most-one refund per source at the database level.
--
--   1. Partial unique index on credit_ledger(source) WHERE type='refund'.
--   2. grant_credits() rewritten so a duplicate refund is a silent no-op:
--      the ledger insert uses ON CONFLICT DO NOTHING against that index,
--      and the balance is only incremented when the insert actually
--      happened. Non-refund types are unaffected.
-- ============================================================

-- ── 1. Clean up any pre-existing duplicate refunds ──────────────────
-- Keep the earliest refund per source, delete later duplicates, so the
-- unique index can be created on live data. (The over-credited balance
-- is NOT clawed back here — handle disputes via the ledger audit trail.)
DELETE FROM public.credit_ledger cl
USING public.credit_ledger keep
WHERE cl.type = 'refund'
  AND keep.type = 'refund'
  AND cl.source IS NOT NULL
  AND cl.source = keep.source
  AND keep.created_at < cl.created_at;

-- ── 2. Partial unique index — at most ONE refund per source ─────────
-- NULL sources never conflict (legacy rows / ad-hoc admin refunds).
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_refund_source
  ON public.credit_ledger (source)
  WHERE type = 'refund';

COMMENT ON INDEX public.idx_credit_ledger_refund_source IS
  'At most one refund per source (video:<id>). Makes pipeline refunds idempotent.';

-- ── 3. grant_credits(): duplicate refund → no-op ────────────────────
-- Rewritten to lock the profile row, attempt the ledger insert FIRST
-- (ON CONFLICT DO NOTHING on the refund index), and only increment the
-- balance when the ledger row was actually written. Returns the
-- unchanged balance on a duplicate refund instead of raising.
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
  v_current_balance integer;
  v_new_balance     integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'grant_credits: amount must be positive (got %)', p_amount
      USING ERRCODE = '22023';
  END IF;

  IF p_type NOT IN ('signup_grant','subscription','topup','refund','admin_grant') THEN
    RAISE EXCEPTION 'grant_credits: invalid type "%"', p_type
      USING ERRCODE = '22023';
  END IF;

  -- Lock the profile row so the balance_after we record stays consistent
  -- with the increment under concurrency.
  SELECT credits INTO v_current_balance
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'grant_credits: profile % not found', p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Ledger insert FIRST. For refunds, idx_credit_ledger_refund_source makes
  -- a second refund with the same source skip the insert (FOUND = false).
  INSERT INTO public.credit_ledger (user_id, type, amount, balance_after, source, metadata)
  VALUES (p_user_id, p_type, p_amount, v_new_balance, p_source, p_metadata)
  ON CONFLICT (source) WHERE type = 'refund' DO NOTHING;

  IF NOT FOUND THEN
    -- Duplicate refund — no-op: return the unchanged balance.
    RETURN v_current_balance;
  END IF;

  UPDATE public.profiles
     SET credits    = v_new_balance,
         updated_at = now()
   WHERE id = p_user_id;

  RETURN v_new_balance;
END;
$$;

-- Re-assert permissions (CREATE OR REPLACE keeps existing grants, but be
-- explicit so this migration is self-contained).
REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, text, jsonb)
  TO service_role;

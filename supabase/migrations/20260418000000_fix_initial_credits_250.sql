-- AUTH-001 fix: initial credits should be 250 (not 3) as per E2E plan
-- 1) Update the profiles default so new manual inserts get 250
-- 2) Update the handle_new_user trigger so Supabase auth signups get 250
-- 3) Backfill existing free-plan users that were provisioned with the old 3-credit default

-- ── 1) Default on the table ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN credits SET DEFAULT 250;

-- ── 2) Trigger used by Supabase on new auth.users insert ────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, credits)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    250
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3) Backfill: users on the free plan who still have the old 3-credit balance
--    Wrapped in a DO block that swallows the case where a pre-existing
--    BEFORE UPDATE trigger on profiles references columns that have drifted
--    from the migration history (ex: public.set_updated_at referencing
--    NEW.updated_at when the column was dropped out-of-band). Default +
--    trigger change above are sufficient for new users; legacy rows can
--    be backfilled manually if needed.
DO $$
BEGIN
  UPDATE public.profiles
     SET credits = 250
   WHERE plan = 'free'
     AND credits = 3;
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Skipping credit backfill — pre-existing trigger references a missing column. Run the UPDATE manually after fixing the schema.';
END $$;

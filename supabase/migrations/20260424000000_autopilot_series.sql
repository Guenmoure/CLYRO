-- ============================================================
-- CLYRO — Autopilot series
-- Lets creators schedule recurring auto-generation of faceless
-- videos from a topic + style template, on a cadence.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.autopilot_series (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- ── Series config ──────────────────────────────────────────
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  topic           text NOT NULL CHECK (char_length(topic) BETWEEN 3 AND 500),
  style           text NOT NULL DEFAULT 'cinematic',

  -- Cadence: how often we auto-generate a new episode.
  -- 'daily'   = every ~24h
  -- 'weekly'  = every ~7d
  -- 'manual'  = never auto-run, only via "Run now"
  cadence         text NOT NULL DEFAULT 'weekly'
                  CHECK (cadence IN ('daily', 'weekly', 'manual')),

  -- Optional defaults inherited by every run
  voice_id        text,
  brand_kit_id    uuid REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  format          text NOT NULL DEFAULT '9:16' CHECK (format IN ('9:16', '16:9', '1:1')),
  duration        integer NOT NULL DEFAULT 60 CHECK (duration BETWEEN 15 AND 300),
  language        text NOT NULL DEFAULT 'fr'   CHECK (char_length(language) BETWEEN 2 AND 8),

  -- ── Scheduling state ───────────────────────────────────────
  enabled         boolean NOT NULL DEFAULT true,
  next_run_at     timestamptz NOT NULL DEFAULT now(),
  last_run_at     timestamptz,
  last_video_id   uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  run_count       integer NOT NULL DEFAULT 0 CHECK (run_count >= 0),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.autopilot_series IS
  'Séries auto-générées : un topic + cadence → une nouvelle vidéo à chaque tick';
COMMENT ON COLUMN public.autopilot_series.cadence IS
  'Périodicité : daily | weekly | manual';
COMMENT ON COLUMN public.autopilot_series.next_run_at IS
  'Prochain déclenchement planifié (utilisé par le scheduler cron)';

-- Indexes: fetch-by-user (dashboard) + scheduler lookup (enabled & due)
CREATE INDEX idx_autopilot_user_id      ON public.autopilot_series(user_id);
CREATE INDEX idx_autopilot_due          ON public.autopilot_series(enabled, next_run_at);

-- updated_at trigger
CREATE TRIGGER trigger_autopilot_series_updated_at
  BEFORE UPDATE ON public.autopilot_series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.autopilot_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autopilot_select_own"
  ON public.autopilot_series FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "autopilot_insert_own"
  ON public.autopilot_series FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "autopilot_update_own"
  ON public.autopilot_series FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "autopilot_delete_own"
  ON public.autopilot_series FOR DELETE
  USING (user_id = auth.uid());

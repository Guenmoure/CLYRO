-- ============================================================
-- CLYRO — Table voice_favorites
-- Voix publiques ElevenLabs marquées en favori par l'utilisateur
-- ============================================================

CREATE TABLE IF NOT EXISTS public.voice_favorites (
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voice_id  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, voice_id)
);

COMMENT ON TABLE public.voice_favorites IS 'Voix publiques ElevenLabs favorites par utilisateur';

CREATE INDEX idx_voice_favorites_user_id ON public.voice_favorites(user_id);

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE public.voice_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_favorites_own"
  ON public.voice_favorites
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

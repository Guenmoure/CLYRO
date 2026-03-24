-- ============================================================
-- CLYRO — Migration initiale
-- Schéma complet avec RLS activé sur toutes les tables
-- ============================================================

-- ── Extension UUID ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE : profiles
-- Étend auth.users avec les infos CLYRO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  plan        text NOT NULL DEFAULT 'free'
              CHECK (plan IN ('free', 'starter', 'studio')),
  credits     integer NOT NULL DEFAULT 3 CHECK (credits >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Ajouter credits si la table existait déjà sans cette colonne
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS
  credits integer NOT NULL DEFAULT 3 CHECK (credits >= 0);

-- Commentaires
COMMENT ON TABLE public.profiles IS 'Profils utilisateurs CLYRO, étend auth.users';
COMMENT ON COLUMN public.profiles.plan IS 'Plan tarifaire : free | starter | studio';
COMMENT ON COLUMN public.profiles.credits IS 'Nombre de crédits vidéo disponibles';

-- Index
CREATE INDEX idx_profiles_plan ON public.profiles(plan);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : videos
-- Vidéos générées par les utilisateurs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module      text NOT NULL CHECK (module IN ('faceless', 'motion')),
  style       text NOT NULL,
  title       text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly', 'done', 'error')),
  output_url  text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Ajouter les colonnes si la table existait déjà sans elles
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS module     text NOT NULL DEFAULT 'faceless' CHECK (module IN ('faceless', 'motion'));
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS style      text NOT NULL DEFAULT '';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS title      text NOT NULL DEFAULT '';
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'storyboard', 'visuals', 'audio', 'assembly', 'done', 'error'));
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS output_url text;
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS metadata   jsonb NOT NULL DEFAULT '{}';

COMMENT ON TABLE public.videos IS 'Vidéos générées par IA';
COMMENT ON COLUMN public.videos.module IS 'Module : faceless | motion';
COMMENT ON COLUMN public.videos.status IS 'Statut du pipeline de génération';
COMMENT ON COLUMN public.videos.metadata IS 'Données du pipeline : scenes, prompts, progress, etc.';

-- Index
CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_created_at ON public.videos(created_at DESC);
CREATE INDEX idx_videos_user_status ON public.videos(user_id, status);

CREATE TRIGGER trigger_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TABLE : cloned_voices
-- Voix clonées via ElevenLabs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cloned_voices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  elevenlabs_voice_id   text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Ajouter les colonnes si la table existait déjà sans elles
ALTER TABLE public.cloned_voices ADD COLUMN IF NOT EXISTS name                text NOT NULL DEFAULT '';
ALTER TABLE public.cloned_voices ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text NOT NULL DEFAULT '';

COMMENT ON TABLE public.cloned_voices IS 'Voix clonées ElevenLabs par utilisateur';
COMMENT ON COLUMN public.cloned_voices.elevenlabs_voice_id IS 'ID de la voix dans ElevenLabs';

CREATE INDEX idx_cloned_voices_user_id ON public.cloned_voices(user_id);

-- ============================================================
-- TABLE : payments
-- Transactions de paiement (Stripe + Moneroo)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider    text NOT NULL CHECK (provider IN ('stripe', 'moneroo')),
  amount      numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency    text NOT NULL DEFAULT 'EUR',
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'success', 'failed')),
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Ajouter les colonnes si la table existait déjà sans elles
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider  text NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe', 'moneroo'));
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount    numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount > 0);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS currency  text NOT NULL DEFAULT 'EUR';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed'));
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS metadata  jsonb NOT NULL DEFAULT '{}';

COMMENT ON TABLE public.payments IS 'Transactions de paiement Stripe et Moneroo';

CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_provider ON public.payments(provider);

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FONCTION : increment_credits
-- Utilisée pour rembourser les crédits en cas d'erreur pipeline
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_credits(user_id uuid, amount integer)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET credits = credits + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FONCTION : Créer automatiquement un profil à l'inscription
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

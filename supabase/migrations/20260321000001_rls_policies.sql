-- ============================================================
-- CLYRO — Row Level Security (RLS)
-- Activer RLS sur toutes les tables + politiques de sécurité
-- ============================================================

-- ── Activer RLS sur toutes les tables ────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloned_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLITIQUES : profiles
-- ============================================================

-- Lecture : seulement son propre profil
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Mise à jour : seulement son propre profil
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insertion : seulement son propre profil (géré par handle_new_user trigger)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- POLITIQUES : videos
-- ============================================================

-- Lecture : seulement ses propres vidéos
CREATE POLICY "videos_select_own"
  ON public.videos
  FOR SELECT
  USING (auth.uid() = user_id);

-- Insertion : seulement pour soi-même
CREATE POLICY "videos_insert_own"
  ON public.videos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Mise à jour : seulement ses propres vidéos
CREATE POLICY "videos_update_own"
  ON public.videos
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Suppression : seulement ses propres vidéos
CREATE POLICY "videos_delete_own"
  ON public.videos
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- POLITIQUES : cloned_voices
-- ============================================================

CREATE POLICY "cloned_voices_select_own"
  ON public.cloned_voices
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "cloned_voices_insert_own"
  ON public.cloned_voices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cloned_voices_delete_own"
  ON public.cloned_voices
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- POLITIQUES : payments
-- ============================================================

-- Lecture seule — l'utilisateur ne peut que voir ses paiements
CREATE POLICY "payments_select_own"
  ON public.payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Pas d'INSERT/UPDATE/DELETE depuis le frontend
-- Les paiements sont créés/mis à jour uniquement par le backend (service role)

-- ============================================================
-- CLYRO — Activer Supabase Realtime sur la table videos
-- Requis pour le suivi de progression live dans le dashboard
-- ============================================================

-- REPLICA IDENTITY FULL permet à Realtime de renvoyer la ligne
-- complète dans le payload (old + new), nécessaire pour le SSE.
ALTER TABLE public.videos REPLICA IDENTITY FULL;

-- Ajouter la table à la publication supabase_realtime
-- (créée automatiquement par Supabase, jamais supprimée)
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;

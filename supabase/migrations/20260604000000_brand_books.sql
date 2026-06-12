-- ============================================================
-- CLYRO — Brand Books (Phase 5 du portage Pomelli)
--
-- Documents de marque générés depuis le Brand Kit (logo + tagline +
-- valeurs + esthétique + ton de voix + business overview). Chaque
-- génération bump la version : une marque peut conserver plusieurs
-- versions de son book et publier celle qu'elle préfère.
--
-- Approche V1 : on stocke un snapshot HTML complet dans `html_snapshot`.
-- Le viewer côté front l'affiche dans un iframe sandbox et propose un
-- bouton « Print to PDF » via window.print() avec un print-optimized
-- stylesheet. La V2 pourra ajouter un upload PDF généré server-side
-- (via Puppeteer/Chromium) si on veut un livrable strict.
--
-- Quand `is_published = true`, `public_token` est généré (uuid) et la
-- route GET /brand/book/public/:token sert le HTML sans authentification.
-- Désactiver la publication remet `public_token = NULL`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_books (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id  uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  version       int  NOT NULL CHECK (version >= 1),
  html_snapshot text NOT NULL,
  is_published  boolean NOT NULL DEFAULT false,
  public_token  uuid,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_kit_id, version)
);

COMMENT ON TABLE  public.brand_books IS 'Guides de marque générés (Phase 5 portage Pomelli)';
COMMENT ON COLUMN public.brand_books.html_snapshot IS 'HTML complet du brand book, interpolé depuis le Brand Kit au moment de la génération';
COMMENT ON COLUMN public.brand_books.public_token IS 'UUID utilisé dans l''URL publique quand is_published=true. NULL si non publié.';

CREATE INDEX idx_brand_books_kit          ON public.brand_books(brand_kit_id);
CREATE INDEX idx_brand_books_user         ON public.brand_books(user_id);
CREATE INDEX idx_brand_books_public_token ON public.brand_books(public_token) WHERE public_token IS NOT NULL;

CREATE TRIGGER trigger_brand_books_updated_at
  BEFORE UPDATE ON public.brand_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.brand_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_books_select_own"
  ON public.brand_books FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "brand_books_insert_own"
  ON public.brand_books FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_books_update_own"
  ON public.brand_books FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "brand_books_delete_own"
  ON public.brand_books FOR DELETE
  USING (user_id = auth.uid());

-- L'accès public par token ne passe PAS par RLS : la route Express
-- `GET /brand/book/public/:token` utilise le service_role et matche
-- explicitement is_published=true AND public_token = :token. Pas de
-- policy "anyone via token" dans la base — voir routes/brand-book.ts.

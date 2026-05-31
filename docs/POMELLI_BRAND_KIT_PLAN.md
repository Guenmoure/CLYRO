# Plan complet — Brand Kit CLYRO inspiré de Pomelli

**Statut** : draft à valider
**Auteur** : Claude (co-auteur)
**Date** : 2026-05-31
**Scope arrêté** : cœur de Pomelli (Business DNA, Catalog, Assets, Campaigns, Photoshoot, Brand Book). **Hors scope** : Websites et Pomelli Agent conversationnel.
**Stack IA** : Claude (texte) + fal.ai (images) + ElevenLabs (voix, si pertinent). Aucun nouveau fournisseur.

---

## 1. Contexte — ce qui existe déjà

Le repo a une fondation Brand Kit plus avancée que ne le laisse penser le module `/brand`. Inventaire :

**Base de données** (migrations) :

| Table | Fichier | Statut |
|---|---|---|
| `brand_kits` | `20260405000000_brand_kits.sql` | basique : logo, 2 couleurs, font, name |
| `brand_assets` (storage bucket) | `20260405000001_brand_assets.sql` | présent |
| `brand_catalog` | `20260531000000_brand_catalog.sql` | ajouté aujourd'hui |
| `autopilot_series` | `20260424000000_autopilot_series.sql` | présent |

**Routes Express** (1081 lignes au total, dans `apps/api/src/routes/`) :

| Route | Lignes | Rôle |
|---|---|---|
| `brand-kits.ts` | 160 | CRUD sur `brand_kits` |
| `brand-agent.ts` | 126 | Agent IA contexte marque |
| `brand-campaigns.ts` | 245 | Génération de campagnes |
| `brand-catalog.ts` | 143 | Produits |
| `brand-photoshoot.ts` | 240 | Photoshoots |
| `brand-generate.ts` | 167 | Génération générique |

**Front** : `app/(dashboard)/brand/` contient `page.tsx`, `hub/page.tsx`, `new/page.tsx`, plus le composant `brand-hub.tsx`. Aucun écran dédié à Catalog, Assets, Campaigns, Photoshoot, Brand Book n'est exposé pour l'instant — c'est essentiellement de la gestion de kit.

**Conclusion** : le backend est partiellement écrit, le front est à construire. Le plan ci-dessous s'appuie sur l'existant et **étend** plutôt qu'il ne remplace.

---

## 2. Vision et architecture macro

### Le principe Pomelli

Le **Business DNA est la racine** : nom, identité visuelle, valeurs, ton, esthétique, infos business. Tout le reste (Catalog, Assets, Campaigns, Photoshoot, Brand Book) le consomme. Modifier un champ du DNA reflète sur tout en aval, parce que chaque génération downstream injecte le DNA dans son prompt.

C'est cette **propagation** qui fait la valeur, plus que les pages prises individuellement.

### L'arborescence cible dans CLYRO

Le module `/brand` actuel devient un hub à plusieurs sous-sections, organisées par Brand Kit. Un utilisateur peut avoir plusieurs Brand Kits (la table le permet déjà avec `user_id` non unique) ; chacun est un univers complet.

```
/brand                                       Hub : liste des Brand Kits + bouton "Nouveau"
/brand/[kitId]                               Redirige vers /brand/[kitId]/dna
/brand/[kitId]/dna                           Business DNA — onglet Brand Overview
/brand/[kitId]/dna/business                  Business DNA — onglet Business Details
/brand/[kitId]/catalog                       Catalog : grille de produits
/brand/[kitId]/catalog/[productId]           Détail / édition produit
/brand/[kitId]/assets                        Assets : médiathèque images
/brand/[kitId]/campaigns                     Liste des campagnes + zone de création
/brand/[kitId]/campaigns/[campaignId]        Galerie de créatives d'une campagne
/brand/[kitId]/campaigns/[campaignId]/[creativeId]  Creative Editor
/brand/[kitId]/photoshoot                    Landing photoshoot (2 modes)
/brand/[kitId]/photoshoot/templates          Product photoshoot avec templates
/brand/[kitId]/photoshoot/generate           Génération / édition d'image libre
/brand/[kitId]/book                          Brand Book (vue + publish + PDF)
```

### Navigation interne (style Pomelli)

Dans chaque page `/brand/[kitId]/...`, une **sidebar verticale à icônes** apparaît à gauche du contenu, avec hover-pour-afficher-le-label, exactement comme Pomelli :

| Icône Material Symbols | Label | Route |
|---|---|---|
| `genetics` | DNA | `/brand/[kitId]/dna` |
| `inventory_2` | Catalog | `/brand/[kitId]/catalog` |
| `image` | Assets | `/brand/[kitId]/assets` |
| `smart_campaign` | Campaigns | `/brand/[kitId]/campaigns` |
| `camera_filter_auto` | Photoshoot | `/brand/[kitId]/photoshoot` |
| `book_5` | Brand Book | `/brand/[kitId]/book` |

Adaptée à la palette éditoriale CLYRO (terracotta `#c45b3a` accent, fond ivoire, Geist + Instrument Serif). Sidebar fixe de 70 px, icône active mise en avant par un trait vertical terracotta.

---

## 3. Modèle de données complet

### 3.1 Extension de `brand_kits` (Phase 1)

Migration `supabase/migrations/20260601000000_brand_dna_extension.sql` qui fait un `ALTER TABLE` non destructif. Toutes les colonnes ajoutées ont un défaut ou sont nullables, donc les lignes existantes restent valides.

```sql
ALTER TABLE public.brand_kits
  -- Brand Overview (Pomelli onglet 1)
  ADD COLUMN IF NOT EXISTS url                  text,
  ADD COLUMN IF NOT EXISTS tagline              text
    CHECK (tagline IS NULL OR char_length(tagline) <= 200),
  ADD COLUMN IF NOT EXISTS brand_values         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_aesthetic      text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_tone_of_voice  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_overview    text
    CHECK (business_overview IS NULL OR char_length(business_overview) <= 2000),
  -- Business Details (Pomelli onglet 2)
  ADD COLUMN IF NOT EXISTS location             text,
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS business_hours       text,
  ADD COLUMN IF NOT EXISTS keywords             text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links         jsonb  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_links            jsonb  NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS testimonials         text;
```

Les RLS existantes (4 policies sur `brand_kits`, toutes par `user_id = auth.uid()`) couvrent automatiquement les nouvelles colonnes. Pas de migration RLS à faire.

### 3.2 Vérification de `brand_catalog` (Phase 2)

Migration déjà appliquée aujourd'hui. Si elle expose `id, brand_kit_id, name, image_url, description, source_url, created_at`, la phase 2 ne touche pas au schéma. À confirmer en lisant la migration au moment d'attaquer la phase.

### 3.3 Vérification de `brand_assets` (Phase 2)

Storage bucket `brand-assets` déjà créé avec RLS par dossier `userId/`. À utiliser tel quel pour la médiathèque. Une table `brand_asset_index` peut s'ajouter si on veut tagger / lister sans scanner le bucket (recommandé).

```sql
CREATE TABLE IF NOT EXISTS public.brand_asset_index (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id  uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  filename      text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  tags          text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- + index + RLS + trigger updated_at
```

### 3.4 Nouvelles tables Campaigns (Phase 3)

```sql
CREATE TABLE public.brand_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id  uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  prompt        text NOT NULL,             -- prompt utilisateur d'origine
  product_id    uuid REFERENCES public.brand_catalog(id) ON DELETE SET NULL,
  asset_ids     uuid[] NOT NULL DEFAULT '{}',
  aspect_ratio  text NOT NULL DEFAULT '9:16'
                CHECK (aspect_ratio IN ('9:16','1:1','4:5')),
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','generating','done','error')),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_creatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url     text NOT NULL,
  header_text   text,
  description_text text,
  cta_text      text,
  blocks_visible jsonb NOT NULL DEFAULT '{"header":true,"description":true,"cta":true}'::jsonb,
  current_version int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_creative_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id   uuid NOT NULL REFERENCES public.brand_creatives(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version_num   int NOT NULL,
  snapshot      jsonb NOT NULL,           -- état complet de la creative à cette version
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

RLS sur les trois tables : `user_id = auth.uid()`, avec `WITH CHECK` sur INSERT/UPDATE.

### 3.5 Nouvelle table Photoshoots (Phase 4)

```sql
CREATE TABLE public.brand_photoshoots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id    uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode            text NOT NULL CHECK (mode IN ('product_template','generate_edit')),
  input_image_url text,                    -- pour product_template
  reference_urls  text[] NOT NULL DEFAULT '{}', -- pour generate_edit (max 10)
  prompt          text,
  template_id     text,                    -- ID du template choisi (système-managed)
  aspect_ratio    text NOT NULL DEFAULT '9:16',
  output_urls     text[] NOT NULL DEFAULT '{}', -- 4 variations
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','generating','done','error')),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

Les **templates de photoshoot** sont system-managed (pas une table user-facing) — un JSON dans `apps/api/src/config/photoshoot-templates.ts` qui liste 9-12 templates initiaux (ex. *bottle on marble*, *cosmetic flat lay*, *food editorial*, etc.) avec leur prompt fal.ai associé. Permet d'ajouter / itérer côté équipe sans migration.

### 3.6 Brand Books (Phase 5)

```sql
CREATE TABLE public.brand_books (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_kit_id  uuid NOT NULL REFERENCES public.brand_kits(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pdf_url       text,                      -- signed URL du PDF dans Storage
  html_snapshot text,                      -- HTML rendu, sert le viewer
  is_published  boolean NOT NULL DEFAULT false,
  public_url    text,                      -- URL publique signée si publié
  version       int NOT NULL DEFAULT 1,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_kit_id, version)
);
```

Un Brand Book est régénéré sur demande ; chaque génération bump la version. La dernière est celle affichée par défaut.

---

## 4. Plan en 5 phases — UI page par page

### Phase 1 — Business DNA étendu (1-2 semaines)

**Backend** :
1. Migration `20260601000000_brand_dna_extension.sql` (section 3.1).
2. `packages/shared/src/types/brand.ts` (créer) : type `BrandKit` complet avec tous les champs Business DNA, types `SocialLinks`, `CtaLink`.
3. `apps/api/src/routes/brand-kits.ts` : étendre les schémas Zod pour PUT/POST, valider les URLs des social_links et cta_links via `z.string().url()`, plafonner les arrays (`brand_values` ≤ 20, `brand_aesthetic` ≤ 20, `keywords` ≤ 30, `cta_links` ≤ 8). Garder `authMiddleware` + envelope d'erreur `{ error, code }`.
4. Tests jest sur les nouvelles validations.

**Front — refonte du module `/brand/[kitId]/dna`** :

Layout 3 colonnes :
- Gauche : sidebar Brand Kit (DNA, Catalog, Assets, Campaigns, Photoshoot, Brand Book) — composant `BrandSidebar.tsx`.
- Centre : contenu de la page, deux onglets en haut « Brand Overview » / « Business Details ».
- Droite (optionnelle, repliable) : panneau de prévisualisation montrant comment le DNA s'applique (carte mock-up Instagram + carte mock-up vidéo cover).

**Onglet 1 — Brand Overview** : sections empilées style éditorial, chaque section avec un bouton edit (pencil icon) qui passe en mode édition inline.

| Section | Composant | Champ DB |
|---|---|---|
| Brand name | Inline text edit | `name` |
| Brand URL | Inline URL edit | `url` |
| Logo | `LogoUploader` (drag-drop, recadrage) | `logo_url` |
| Colors | `ColorPalette` (4 swatches éditables) | `primary_color`, `secondary_color` |
| Fonts | `FontPicker` (2 polices max) | `font_family` |
| Tagline | Inline text edit | `tagline` |
| Brand values | `TagInput` (chips ajout/suppr) | `brand_values` |
| Brand aesthetic | `TagInput` | `brand_aesthetic` |
| Brand tone of voice | `TagInput` | `brand_tone_of_voice` |
| Business overview | Textarea autosize | `business_overview` |

Sauvegarde par PATCH incrémental, debounce 800 ms. Toast discret « Enregistré » en bas à droite.

**Onglet 2 — Business Details** :

| Section | Composant | Champ DB |
|---|---|---|
| Location | Inline text | `location` |
| Phone | Inline text | `phone` |
| Business hours | Textarea courte | `business_hours` |
| Keywords | `TagInput` | `keywords` |
| Social links | `SocialLinksEditor` (icône + URL par réseau : facebook, instagram, linkedin, twitter, youtube, tiktok, pinterest) | `social_links` |
| Call-to-action links | `CtaLinkList` (label + URL, ajout/suppr, ≤ 8) | `cta_links` |
| Testimonials | Textarea longue | `testimonials` |

**Composants nouveaux à créer** (réutilisables dans tout le module) :
- `TagInput.tsx` — input avec chips, virgule ou Entrée pour ajouter, suppression au clic
- `SocialLinksEditor.tsx` — liste prédéfinie de 7 réseaux, chaque ligne = icône + input URL
- `CtaLinkList.tsx` — liste éditable de paires `{label, url}`
- `LogoUploader.tsx` — drag-drop vers Supabase Storage bucket `brand-assets/<userId>/logos/`
- `ColorPalette.tsx` — 4 swatches éditables avec color picker
- `FontPicker.tsx` — liste de polices Google Fonts (Inter, Plus Jakarta Sans, Playfair Display, etc.)
- `BrandSidebar.tsx` — sidebar à icônes
- `BrandKitLayout.tsx` — layout enveloppant les 6 sous-pages

**Propagation dans les pipelines existants** : le `brand_config` passé à `motion-design`, `motion-router` et `faceless` reçoit aujourd'hui `primary_color, secondary_color, font_family, logo_url`. On l'enrichit pour inclure les champs Business DNA pertinents. Côté Claude (`services/claude.ts`), `generateMotionDesignScenes` et `generateMotionStoryboard` enrichissent leur `brandLine` avec, quand présents :

```
Brand tagline: "<tagline>"
Tone of voice: <brand_tone_of_voice joined>
Brand values: <brand_values joined>
Visual aesthetic: <brand_aesthetic joined>
Business overview: <business_overview>
```

C'est ce qui transforme un Motion Design générique en Motion Design *vraiment* on-brand. Mesure du gain : sur le même brief, comparer une génération avec / sans DNA enrichi. Si la différence n'est pas frappante, ajuster les prompts jusqu'à ce qu'elle le soit.

**Critères d'acceptation Phase 1** :
1. La migration s'applique sans casser les lignes existantes.
2. `GET /api/v1/brand-kits/:id` renvoie tous les nouveaux champs avec leurs valeurs par défaut.
3. `PUT /api/v1/brand-kits/:id` accepte un payload partiel et persiste correctement.
4. L'onglet Brand Overview se sauvegarde en debounce, sans flicker.
5. Une vidéo Motion Design générée avec un DNA riche (tagline, ton, valeurs renseignés) est *visiblement* plus on-brand qu'avec le même brief et un kit vide.

---

### Phase 2 — Catalog + Assets (1 semaine)

**Backend** :
1. Vérifier la migration `20260531000000_brand_catalog.sql` et son contenu. Si elle expose ce qu'on a décrit en 3.2, no-op. Sinon, migration d'extension.
2. Migration `brand_asset_index` (section 3.3).
3. `apps/api/src/routes/brand-catalog.ts` :
   - `POST /catalog` — `{ brand_kit_id, name, image_url, description }`
   - `POST /catalog/from-url` — `{ brand_kit_id, url }` → service de scraping (cheerio + meta tags Open Graph + JSON-LD product schema) → renvoie un draft à confirmer
   - `GET /catalog?brand_kit_id=` — liste
   - `DELETE /catalog/:id`
4. `apps/api/src/routes/brand-assets.ts` (nouveau) :
   - `POST /assets/upload` — upload direct vers Storage + INSERT dans `brand_asset_index`
   - `POST /assets/from-url` — fetch + upload
   - `GET /assets?brand_kit_id=` — liste paginée
   - `DELETE /assets/:id`
5. Nouveau service `apps/api/src/services/product-scraper.ts` qui prend une URL e-commerce et extrait `{ name, image_url, description, price?, source_url }` via cheerio + heuristiques (Open Graph, JSON-LD `Product` schema, fallback sur `<title>` + première image hero).

**Front — page `/brand/[kitId]/catalog`** :

Header : « Catalog » + 2 boutons en haut à droite : `Add from URL` (ouvre une modale avec input URL → scraping → confirmation) et `Add from scratch` (ouvre un formulaire vide).

Corps : grille responsive de cartes produit (`ProductCard.tsx`). Chaque carte : image + nom + menu contextuel (edit, delete). Card cliquable → `/brand/[kitId]/catalog/[productId]` pour édition détaillée.

Empty state : illustration + bouton « Add your first product ».

**Front — page `/brand/[kitId]/assets`** :

Header : « Assets — Endless creatives, ready in minutes » + CTA discret « → Try Photoshoot ». Deux boutons : `Upload Images` (input file multi-select) et `Add from URL` (modale).

Corps : grille masonry-ish d'images, drag-drop area en haut couvrant toute la zone vide. Filtre par tags si la lib des tags est utilisée. Lightbox sur clic. Multi-sélection pour suppression en lot.

**Composants nouveaux** :
- `ProductCard.tsx`
- `AssetCard.tsx`
- `AddFromUrlModal.tsx` (réutilisé Catalog + Assets)
- `DragDropUploader.tsx`
- `Lightbox.tsx` (ou utiliser un lib léger)

**Critères d'acceptation Phase 2** :
1. Add from URL pour 5 URLs e-commerce différentes (Shopify, WooCommerce, BigCommerce, Squarespace, custom) renvoie un draft correctement rempli dans ≥ 4 cas sur 5.
2. L'upload d'images supporte JPG/PNG/WebP jusqu'à 10 MB.
3. Drag-drop multiple fonctionne (jusqu'à 20 fichiers d'un coup).
4. Suppression d'un produit ou asset est immédiate et retire la ressource du Storage.

---

### Phase 3 — Campaigns + Creative Editor (2-3 semaines)

C'est la phase la plus lourde — c'est aussi le différenciant Pomelli. Décomposée en sous-phases.

**Sous-phase 3.1 — Schéma + routes (~3 jours)**

1. Migration créant `brand_campaigns`, `brand_creatives`, `brand_creative_versions` (section 3.4).
2. `apps/api/src/routes/brand-campaigns.ts` : étendre pour POST `/campaigns` (créer un draft avec prompt), POST `/campaigns/:id/generate` (lance la génération), GET `/campaigns/:id` (état + créatives), POST `/campaigns/:id/creatives` (régénérer une variation), DELETE.
3. Nouveau pipeline `apps/api/src/pipelines/brand-campaign.ts` :
   - Étape 1 : Claude reçoit `{prompt, brand_kit DNA complet, product?, assets?}` et produit un « campaign brief » structuré : `{ campaign_title, campaign_description, 3 creative_prompts: [{visual_prompt, header, description, cta}, ...] }`.
   - Étape 2 : pour chaque creative_prompt, fal.ai génère une image (modèle text-to-image, choix selon style brand). En parallèle.
   - Étape 3 : composition du text overlay côté front (pas de baking image+text à ce stade — l'overlay est rendu en SVG/HTML par-dessus pour permettre l'édition).
   - Étape 4 : UPDATE `brand_creatives` avec `image_url` + `header_text` + `description_text` + `cta_text`, et INSERT version 1 dans `brand_creative_versions`.
4. Si la durée totale > 30 s, passer par BullMQ (job type `brand_campaign`) comme on l'a fait pour Motion. Étape 0 SSE pour `phase` + `progress`.

**Sous-phase 3.2 — UI page `/brand/[kitId]/campaigns` (~3 jours)**

Layout : 2 zones empilées.

**Zone du haut — création centrale** (style Pomelli prompt box) :
- Titre éditorial : « Campaigns » + sous-titre « Start from our suggestions or prompt to create a new campaign. »
- Une « card » centrale en focus :
  - Textarea : « Describe the campaign you want to create »
  - Icône microphone (voice input, plug sur l'API browser pour transcription, optionnel V1.5)
  - Bouton `Product` → ouvre modale de sélection produit dans le Catalog
  - Bouton `Images` → ouvre modale de sélection assets
  - Dropdown `Aspect Ratio` : Story (9:16) / Square (1:1) / Feed (4:5)
  - Bouton primaire `Generate Brief` (avec icône `auto_awesome`)
- Disclaimer micro : « CLYRO can make mistakes, so double-check it. »

**Zone du bas — suggestions** :
- Titre « Suggestions based on Business DNA »
- 3 cartes générées automatiquement à l'ouverture (Claude lit le DNA et propose 3 directions de campagne avec miniatures fal.ai cachées en background)
- Chaque carte : thumbnail + title + description courte + menu `more_vert`

**Composant `CampaignPromptBox.tsx`** : la card centrale, réutilisable.

**Sous-phase 3.3 — UI page `/brand/[kitId]/campaigns/[campaignId]` (~3 jours)**

Layout 2 colonnes.

**Sidebar gauche (~300 px)** :
- Icône campagne (auto-générée ou emoji DNA)
- Titre éditable inline
- Description complète éditable
- Section « Product » avec image + nom du produit attaché (si présent)
- Section « Source assets » listant les assets utilisés

**Zone principale** :
- Titre « Creatives » + bouton « + Add Creative » qui régénère une variation supplémentaire
- Scroll horizontal de cartes créatives format portrait (largeur fixe, hauteur dépendant de l'aspect ratio)
- Chaque carte (`CreativeCard.tsx`) :
  - Image avec text overlay rendu en SVG (header, description, CTA) — toggle visibility pour chacun via les icônes œil
  - 4 boutons en bas : `more_vert` (options) / `share` / `Animate` (envoie la créative au pipeline Motion pour produire une vidéo MP4, super fonctionnalité de croisement) / `font_download_off` (retire le text overlay)
  - Clic sur la carte → `/brand/[kitId]/campaigns/[campaignId]/[creativeId]` (éditeur détaillé)

**Le bouton `Animate` est le pont entre Brand Kit et Motion** : la créative devient le storyboard d'une scène et part dans le pipeline Motion existant. Pour Phase 3 V1, version simple : envoyer juste l'image + le texte comme scène de cover, le reste de la vidéo est généré classiquement par Claude.

**Sous-phase 3.4 — Creative Editor `/brand/[kitId]/campaigns/[campaignId]/[creativeId]` (~5 jours)**

C'est l'écran le plus interactif. Layout 3 colonnes.

**Header** :
- Breadcrumb : « ← Back to [Campaign Name] »
- Version History : `← 1/N →` boutons, et un bouton qui affiche la liste déroulante des versions
- Bouton `Fix Layout` (IA réorganise le text overlay pour éviter les chevauchements)
- Bouton `Download` (sort la créative en PNG/JPG haute résolution via canvas rendering)

**Colonne 1 — Prévisualisation (~50% largeur)** :
- Aperçu live au ratio choisi
- L'image fait fond, le text overlay est rendu en HTML/CSS positionné absolu (drag pour repositionner manuellement)
- Barre `Fix Layout` flottante en bas avec « Fix Layout » et « Refresh image »

**Colonne 2 — Éditeur par blocs (~30% largeur)** :
- Chaque bloc est une card expandable :
  - **Image** : miniature 80×80 + bouton « Edit » qui ouvre une modale (3 options : remplacer depuis Assets / regénérer via prompt fal.ai / éditer via prompt)
  - **Header** : input text + toggle œil pour visibility + slider taille de police
  - **Description** : textarea + toggle œil + slider taille
  - **Call To Action** : input text + bouton « Generate » qui demande à Claude une variante CTA basée sur le contexte de la creative + bouton style (pill / underline / button-rounded)
- Chaque modification met à jour le preview en temps réel
- Sauvegarde auto debounce 1.5 s, snap au `brand_creative_versions` toutes les 5 sauvegardes ou sur action explicite « Save version »

**Colonne 3 — Brand DNA quick reference (~20% largeur, optionnelle, repliable)** :
- Mini-card avec logo + couleurs + tagline + tone — rappel visuel de ce qui doit guider le créatif

**Composants nouveaux** :
- `CreativeCard.tsx`, `CreativePreview.tsx`, `BlockEditor.tsx` (image / header / description / CTA en sous-composants), `VersionHistoryDropdown.tsx`, `FixLayoutButton.tsx`, `AnimateButton.tsx`, `BrandQuickRef.tsx`

**Critères d'acceptation Phase 3** :
1. Un prompt simple + un produit du catalog produit 3 créatives en moins de 90 s (Claude + fal.ai en parallèle).
2. L'édition d'un bloc met à jour le preview sans lag perceptible.
3. La version history permet de revenir à N versions arrière et de repartir d'une ancienne.
4. Fix Layout bouge effectivement le text overlay pour éviter les chevauchements (Claude vision + retour des coordonnées).
5. Animate envoie correctement la créative au pipeline Motion et produit une vidéo cover de 6-15 s.

---

### Phase 4 — Photoshoot (1-2 semaines)

**Backend** :
1. Migration `brand_photoshoots` (section 3.5).
2. `apps/api/src/config/photoshoot-templates.ts` : JSON de 9-12 templates initiaux, chacun `{ id, name, category, thumbnail_url, prompt_template, model: 'fal-ai/...' }`.
3. `apps/api/src/routes/brand-photoshoot.ts` (existant 240 lignes — à auditer et compléter) :
   - `POST /photoshoot/templates` — `{ brand_kit_id, input_image_url, template_id, aspect_ratio }` → enqueue
   - `POST /photoshoot/generate` — `{ brand_kit_id, prompt, reference_urls: string[≤10], aspect_ratio }` → enqueue
   - `GET /photoshoot/:id` — état + outputs
4. Pipeline `apps/api/src/pipelines/brand-photoshoot.ts` :
   - Mode `product_template` : fal.ai image-to-image avec le `prompt_template` du template + `input_image_url`. Génère 4 variations en parallèle.
   - Mode `generate_edit` : fal.ai text-to-image OU image-to-image selon présence de reference_urls. Génère 4 variations.
   - UPDATE `brand_photoshoots.output_urls` au fur et à mesure.

**Front — page `/brand/[kitId]/photoshoot`** :

Vue 2 cards centrales :
- Card 1 : « Create a product photoshoot » / « Choose a product image and templates to get professional shots » + grille 3×3 de vignettes de templates en aperçu
- Card 2 : « Generate or edit an image » / « Describe the image you want with a prompt or edit an existing one » + image générée d'exemple

Clic → `/photoshoot/templates` ou `/photoshoot/generate`.

**Sous-page `/photoshoot/templates`** :

Layout 2 colonnes :
- Gauche : « Product Image » — zone d'upload + selector Aspect Ratio (Story 9:16 par défaut, dropdown)
- Droite : « Photoshoot Templates » — grille 3×4 de templates avec aperçu (image template), case « Select Template » sélectionnée par radio
- CTA primaire en bas : `Generate Photoshoot` (grisé tant que pas d'image + pas de template)

À la génération : overlay style Motion (anneau de progression + stages) + page de résultat avec les 4 variations côte à côte, chacune avec Download / Save to Assets / Open in Editor.

**Sous-page `/photoshoot/generate`** :

Layout 1 colonne centrée :
- Zone de prompt : « Edit this image (Press + to add image)... »
- Bouton `+ Add Images` (jusqu'à 10, counter `0/10 images`)
- Selector aspect ratio
- Disclaimer anti-hallucination
- Bouton `Generate` (grisé si prompt vide)

Idem résultat : 4 variations.

**Composants nouveaux** :
- `PhotoshootTemplateGrid.tsx`, `PhotoshootInputImage.tsx`, `ReferenceImageList.tsx`, `PhotoshootResult.tsx`

**Critères d'acceptation Phase 4** :
1. Un upload de photo de produit + sélection d'un template produit 4 variations cohérentes en < 60 s.
2. Generate/Edit avec 3 images de référence respecte le style des refs.
3. Aucune variation ne dépasse 5 MB en sortie (réglage qualité fal.ai).
4. Save to Assets push correctement vers la médiathèque.

---

### Phase 5 — Brand Book (1 semaine)

**Backend** :
1. Migration `brand_books` (section 3.6).
2. `apps/api/src/routes/brand-book.ts` (nouveau) :
   - `POST /book/generate` — `{ brand_kit_id }` → lit le brand kit complet, rend un template HTML, convertit en PDF via le skill `pdf`, upload PDF dans Storage, INSERT row
   - `POST /book/:id/publish` — flip `is_published`, crée une signed URL publique 30 jours
   - `POST /book/:id/unpublish`
   - `GET /book?brand_kit_id=` — dernière version
3. Service `apps/api/src/services/brand-book-renderer.ts` : prend un `BrandKit` complet et un template HTML (`apps/api/src/templates/brand-book/default.html`), interpole les valeurs, renvoie un Buffer PDF via le skill `pdf` (déjà installé dans le repo).

**Template HTML — sections** :

| Section | Contenu |
|---|---|
| Cover | Nom + tagline + couleur primaire en fond |
| Logo | Logo principal + 4 variantes (sur fond clair, fond sombre, fond couleur primaire, fond couleur secondaire) + indication de clear space + taille minimum |
| Tagline | Citation centrée en grande typo |
| Brand Values | Liste des `brand_values` en cards |
| Aesthetic | Mots-clés `brand_aesthetic` + grille de 4 mood images générées via fal.ai à la première génération (cachées dans Storage et réutilisées) |
| Tone of Voice | Descripteurs `brand_tone_of_voice` + 3 exemples de phrases dans le ton (Claude génère 3 micro-phrases) |
| Business Overview | Paragraphe `business_overview` |
| Footer | URL + social_links + footer CLYRO discret |

**Front — page `/brand/[kitId]/book`** :

Header :
- Titre « Brand Book »
- Badge `Not published` (rouge discret) ou `Published` (vert discret)
- Boutons : `Publish` toggle / `Download PDF` / `Open in New Tab` / `Edit` (menu déroulant : Regenerate / Replace mood images / Edit cover)

Corps : viewer du PDF en iframe avec sidebar de navigation par section (table of contents). Sur petit écran, viewer vertical scrollable.

**Composants nouveaux** :
- `BrandBookViewer.tsx`, `PublishToggle.tsx`

**Critères d'acceptation Phase 5** :
1. Génération depuis un brand kit complet produit un PDF visuellement cohérent en < 30 s.
2. Publish/Unpublish change instantanément l'état + la signed URL publique.
3. Download PDF respecte les polices (fonts embedded ou web-safe fallback).
4. La régénération bump la version sans supprimer les anciennes (historique conservé).

---

## 5. Stack IA et coûts

| Feature | Service | Modèle | Coût indicatif par appel |
|---|---|---|---|
| Brand Overview enrichissement prompts | Claude Sonnet 4.6 | déjà câblé | ~$0.01 |
| Suggestions campagnes | Claude Sonnet 4.6 | text | ~$0.02 |
| Génération campaign brief | Claude Sonnet 4.6 | text | ~$0.03 |
| Génération images créatives | fal.ai FLUX.2 / Seedream | image | ~$0.04 × 3 par campagne |
| Photoshoot templates | fal.ai (image-to-image) | image | ~$0.04 × 4 par photoshoot |
| Photoshoot generate/edit | fal.ai Nano Banana Pro / Seedream | image | ~$0.04 × 4 |
| Brand Book mood images | fal.ai | image | ~$0.04 × 4 (one-shot, caché) |
| Brand Book PDF rendering | local (skill pdf) | — | $0 |
| Scraping produit | local (cheerio) | — | $0 |
| Fix Layout / CTA generation | Claude Haiku 4.5 | text | ~$0.005 |

Aucun nouveau fournisseur. Les rate-limits (`pipelineLimiter` 20/h) et la déduction de crédits préalable (cf. `.claude/rules/security.md`) couvrent les nouvelles routes — il faut juste s'assurer que chaque route lourde passe par `pipelineLimiter` et déduit ses crédits avant l'appel upstream.

---

## 6. Timeline et estimation d'effort

Une personne dédiée à temps plein :

| Phase | Effort | Cumul |
|---|---|---|
| 1 — Business DNA | 1-2 semaines | 2 |
| 2 — Catalog + Assets | 1 semaine | 3 |
| 3 — Campaigns + Editor | 2-3 semaines | 6 |
| 4 — Photoshoot | 1-2 semaines | 8 |
| 5 — Brand Book | 1 semaine | 9 |

Total : **6 à 9 semaines** pour la parité avec le cœur de Pomelli, hors Websites et Agent. À mi-temps, multiplier par 2.

Risques pouvant rallonger :
- L'éditeur de Creative (3.4) est l'inconnue principale — le drag du text overlay + Fix Layout via Claude peuvent demander 2-3 jours de plus si on veut une UX vraiment fluide.
- Le scraping produit (2) couvre rarement 100 % des sites — prévoir un mode dégradé « formulaire manuel pré-rempli » si l'extraction rate plus de 30 %.

---

## 7. Hors scope (rappel)

- **Websites** — générateur de site complet style Pomelli `/website`. Énorme chantier qui sort du périmètre vidéo / brand kit.
- **Pomelli Agent** — chatbot conversationnel multimodal. Possible plus tard si CLYRO veut s'orienter assistant marque, mais pas dans ce plan.

---

## 8. Décisions ouvertes à confirmer

Quatre décisions de produit que je n'ai pas tranchées seul :

1. **Multiplicité des Brand Kits par utilisateur** : la table actuelle le permet (`is_default` existe), mais l'UX devrait-elle activement encourager plusieurs kits (agence avec plusieurs clients) ou rester mono-kit par défaut ?
2. **Sélection automatique du Brand Kit dans les pipelines vidéo** : aujourd'hui le wizard Motion envoie un `brand_config` ad-hoc. Faut-il qu'il propose explicitement « Use Brand Kit » avec dropdown → préremplit tous les champs ?
3. **Partage / collaboration** : un Brand Kit peut-il être partagé entre membres d'une organisation (table `org_brand_kit_members`) ou reste-t-il strictement individuel ?
4. **Crédit modèle pour les nouvelles features** : combien de crédits pour une campagne (3 créatives) ? un photoshoot (4 variations) ? un brand book ? À calibrer en cohérence avec la grille existante motion / faceless.

---

## 9. Premier livrable concret

Une fois ce plan validé, j'attaque la **Phase 1** dans cet ordre :

1. Migration `20260601000000_brand_dna_extension.sql`
2. Types `packages/shared/src/types/brand.ts`
3. Extension Zod dans `apps/api/src/routes/brand-kits.ts`
4. Composants réutilisables : `TagInput`, `SocialLinksEditor`, `CtaLinkList`, `LogoUploader`, `ColorPalette`, `FontPicker`
5. Layout `BrandKitLayout.tsx` + `BrandSidebar.tsx`
6. Page `/brand/[kitId]/dna` avec ses 2 onglets
7. Propagation Business DNA dans `services/claude.ts` (motion + motion-design)
8. Tests + typecheck + commit

Estimation Phase 1 : 1 à 2 semaines, ~15-20 fichiers touchés, 0 nouveau service externe.

---

*Fin du plan. À valider avant code.*

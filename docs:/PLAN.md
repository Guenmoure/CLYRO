# PLAN.md — Plan de développement CLYRO

**Méthodologie :** Sprints de 1 semaine
**Outil IA :** Claude Code (VS Code extension)
**Objectif :** MVP fonctionnel + déployé en production

---

## Résumé des phases

| Phase | Description | Semaines | Feature |
|-------|-------------|----------|---------|
| **Phase 0** | Setup & fondations communes | S1–S2 | Infra |
| **Phase 1** | Auth + Dashboard squelette | S2–S3 | Infra |
| **Phase 2** | F1 — Script, découpage, UI scènes | S3–S4 | F1 |
| **Phase 3** | F1 — Génération images et voix | S5–S6 | F1 |
| **Phase 4** | F1 — Animation, composition, export | S7–S9 | F1 |
| **Phase 5** | F2 — Storyboard JSON et composants Remotion | S10–S11 | F2 |
| **Phase 6** | F2 — Assets, audio et rendu final | S12–S13 | F2 |
| **Phase 7** | F3 — Brief, directions créatives et logos | S14–S15 | F3 |
| **Phase 8** | F3 — Assets, charte PDF et export | S15–S17 | F3 |
| **Phase 9** | Launch — Billing, onboarding, analytics | S17–S18 | Launch |

**Durée totale estimée : 18 semaines**

> **Règle d'or :** F1 avant F2 (F2 réutilise ~65% de l'infra F1). F3 après F2 (pipeline indépendant). Ne jamais commencer une phase sans avoir validé le milestone de la phase précédente.

---

## Phase 0 — Setup & Fondations communes (S1–S2)

Toutes les features partagent les mêmes clients API. Les coder ici une seule fois évite 2–3 semaines de dette technique.

### Étape 0.1 — Repository GitHub

```
✅ Créer repo GitHub : clyro (privé)
✅ Structure monorepo : apps/web, apps/api, packages/shared, remotion/
✅ .gitignore, .env.example (valeurs fictives uniquement)
✅ README.md basique
```

**Prompt Claude Code :**
> « Initialise un monorepo Node.js avec la structure de CLAUDE.md : apps/web (Next.js 14), apps/api (Express + TypeScript), packages/shared (types), remotion/ (compositions). Ajoute les .gitignore appropriés et un .env.example complet basé sur ARCHITECTURE.md section 12. »

---

### Étape 0.2 — Supabase — Auth, DB, Storage, Realtime

```
✅ Créer projet Supabase (région eu-west-1)
✅ Migrations SQL : profiles, usage, projects, scenes, brand_projects, cloned_voices, payments
✅ RLS activé sur toutes les tables (voir ARCHITECTURE.md section 8.1)
✅ Vues SQL : mrr_by_plan
✅ Storage buckets : videos/, brands/, voice-samples/
✅ Auth : Email, Google OAuth, Apple Sign-In
✅ Realtime activé sur tables projects et scenes
```

**Prompt Claude Code :**
> « Génère les migrations Supabase dans supabase/migrations/ pour toutes les tables de ARCHITECTURE.md section DB (profiles, usage, projects, scenes, brand_projects, cloned_voices, payments). Inclure les politiques RLS de la section 8.1 et les vues SQL. Nommer les fichiers YYYYMMDDHHMMSS_description.sql. »

---

### Étape 0.3 — Wrappers API centralisés (Backend)

**Claude wrapper** — `services/claude.ts`
```
✅ Client Anthropic unique avec gestion erreurs + retry x2
✅ Support streaming
✅ Système de prompt templates par feature (chargés depuis fichiers)
✅ Logging tokens utilisés
```

**fal.ai wrapper** — `services/fal.ts`
```
✅ Client avec timeout 30s, retry x2 avec backoff exponentiel
✅ Fallback automatique flux-pro → flux/schnell si timeout
✅ Upload résultat → Supabase Storage automatique
✅ Retour URL publique Supabase
✅ MODEL_MAP centralisé (voir ARCHITECTURE.md sections 4.3, 5.4, 6.2)
✅ Stratégie preview-first (flux/schnell puis flux-pro en background)
```

**ElevenLabs wrapper** — `services/elevenlabs.ts`
```
✅ Client /with-timestamps uniquement
✅ Parser word timestamps → format Remotion
✅ Upload audio → Supabase Storage
✅ Stockage timestamps_json dans table scenes
```

**Remotion client** — `services/remotion.ts`
```
✅ renderMediaOnLambda() configuré
✅ getRenderProgress() avec polling
✅ Warm-up Lambda (cron toutes les 4 minutes)
✅ Variables AWS dans .env
```

**FFmpeg service** — `services/ffmpeg.ts`
```
✅ POST /mix-audio : mix voix off + musique avec ducking
✅ POST /generate-thumbnail : frame à t=3s
✅ POST /generate-pdf : Puppeteer → PDF streamé vers Supabase
✅ Auth inter-services HMAC (middleware/hmac.ts)
✅ Health check GET /health : { status, ffmpeg, puppeteer }
```

**Prompt Claude Code :**
> « Crée tous les services wrappers dans apps/api/services/ selon ARCHITECTURE.md sections 4 à 6. Chaque wrapper doit implémenter le retry logic, le logging structuré, et l'upload automatique vers Supabase Storage. Le service FFmpeg tourne sur Render avec authentification HMAC (voir ARCHITECTURE.md section 3.4). »

---

### Étape 0.4 — App shell Next.js

```
✅ Tailwind configuré avec couleurs CLYRO (CLAUDE.md Design System)
✅ shadcn/ui init avec couleurs primary → --blue-500
✅ Polices Google Fonts : Syne, DM Sans, JetBrains Mono
✅ lib/supabase.ts (client browser)
✅ lib/api.ts (client HTTP backend avec JWT)
✅ app/(dashboard)/layout.tsx : sidebar + stepper persistant
✅ Composant ProgressTracker générique réutilisé par les 3 features
✅ Skeleton loading states
✅ Empty states actionnables (3 features en cards avec CTA)
```

**Milestone S2 :**
> Un rendu Remotion Lambda fonctionne. Un call fal.ai retourne une image stockée sur Supabase. Un call ElevenLabs retourne audio + timestamps. Tous les services health check passent.

---

## Phase 1 — Auth + Dashboard (S2–S3)

### Étape 1.1 — Pages Auth

```
✅ app/(auth)/login/page.tsx
✅ app/(auth)/signup/page.tsx
✅ Formulaires : LoginForm, SignupForm
✅ SocialAuthButtons : Google OAuth + Apple Sign-In
✅ app/api/auth/callback/route.ts (OAuth callback Supabase)
✅ middleware.ts : protection routes /dashboard
```

**Prompt Claude Code :**
> « Crée les pages login et signup avec le design CLYRO (fond navy-950, accent blue-500, gradient grad-primary sur les CTA). Utilise @supabase/auth-helpers-nextjs. La page signup : email/password + Google + Apple. Formulaires validés avec Zod. Responsive mobile-first. »

---

### Étape 1.2 — Dashboard squelette

```
✅ app/(dashboard)/dashboard/page.tsx : stats + CTA 3 modules
✅ Sidebar : logo, navigation, crédits restants, avatar utilisateur
✅ hook useUser() : profil Supabase
✅ hook useQuota() : usage mensuel par feature
✅ Composant BillingBanner : alerte si quota proche
```

---

## Phase 2 — F1 — Script, découpage, UI scènes (S3–S4)

### Étape 2.1 — Prompt system Claude Scene Director

```
✅ Prompt system F1 dans apps/api/prompts/f1-scene-director.txt
✅ Tester sur 10 scripts différents avant intégration UI
✅ Valider : JSON parseable, styles dans les prompts, durées cohérentes
✅ Fonction generateStoryboard(script, style, voiceId) → SceneJSON[]
```

**Prompt Claude Code :**
> « Crée le prompt system Scene Director pour F1 (voir ARCHITECTURE.md section 4.2). Il doit retourner un JSON strict avec summary, text, duration_estimate, image_prompt (en anglais avec style), animation_prompt. Tester sur le script exemple "5 faits sur les pieuvres" avec le style animation-2d. »

---

### Étape 2.2 — UI wizard F1 — Script + configuration

```
✅ app/(dashboard)/faceless/new/page.tsx
✅ Step 1 : Textarea script + compteur mots + estimation durée live
✅ Step 2 : Sélecteur style (grille avec exemple vidéo 10s par style)
✅ Step 3 : Sélecteur voix (bibliothèque + preview audio 3s)
✅ Description visuelle complémentaire (optionnel)
✅ Validation Zod avant soumission
✅ Sauvegarde auto dans Supabase (auto-save)
```

---

### Étape 2.3 — UI scènes — affichage et édition

```
✅ Cards par scène : résumé, durée, prompt image + animation éditables
✅ Drag-and-drop pour réordonner
✅ Bouton "Ajouter scène" et "Fusionner"
✅ Bouton "Améliorer via IA" sur chaque prompt
✅ Sauvegarde auto à chaque changement
✅ Route POST /api/v1/pipeline/faceless (crée projet + déclenche Claude)
```

---

## Phase 3 — F1 — Génération images et voix (S5–S6)

### Étape 3.1 — Génération images fal.ai (preview-first)

```
✅ Toutes les scènes lancées en parallèle (Promise.all)
✅ flux/schnell d'abord → preview en 3s dans l'UI
✅ flux-pro en background → remplace silencieusement quand prêt
✅ Spinner indépendant par scène
✅ Upload automatique Supabase Storage
✅ UPDATE scenes SET image_url, image_quality après chaque scène
```

---

### Étape 3.2 — UI images — comparaison et régénération

```
✅ Affichage image par scène avec indicateur draft/HD
✅ Bouton "Régénérer" individuel
✅ Bouton "Améliorer via IA" (Claude explique les changements)
✅ Slider comparaison avant/après (3 versions max en mémoire Supabase)
✅ Zoom sur image avec prompt affiché en overlay
```

---

### Étape 3.3 — ElevenLabs voiceover + recalcul timing

```
✅ Génération audio par scène en parallèle (indépendant des images)
✅ Parser word timestamps → format KaraokeCaption Remotion
✅ Logique recalcul : si audio_duration > duration_estimate → ajuster duration_frames
✅ Player audio inline par scène
✅ Upload audio + timestamps_json → Supabase Storage + table scenes
```

---

### Étape 3.4 — Cohérence visuelle

```
✅ Extraire style anchor de la 1ère image validée (couleurs, personnage)
✅ Injecter style anchor dans tous les prompts suivants
✅ Si changement de style global : vider cache cohérence + proposer régénération
```

**Milestone S6 :**
> L'utilisateur voit toutes ses images et entend sa voix. Montrer à 5 beta-testeurs avant de construire l'animation. Si les images ne convainquent pas, réviser les prompt systems Claude.

---

## Phase 4 — F1 — Animation, composition, export (S7–S9)

### Étape 4.1 — fal.ai image-to-video Kling

```
✅ Une requête Kling par scène (image HD validée requise)
✅ Durée clip = audio_duration + 0.5s buffer
✅ Stockage clip_url dans table scenes
✅ Player preview par clip
✅ Régénération individuelle avec prompt animation modifié
```

---

### Étape 4.2 — Composition Remotion FacelessVideo

```
✅ remotion/FacelessVideo.tsx : Sequence par scène + Video + Audio
✅ KaraokeCaption.tsx : rendu mot-par-mot avec word timestamps ElevenLabs
✅ Tester dans Remotion Studio avec inputProps mockés
✅ Valider : sous-titres synchronisés, transitions fluides, karaoke visible
```

**Prompt Claude Code :**
> « Crée la composition Remotion FacelessVideo.tsx (voir ARCHITECTURE.md section 4.5) et le composant KaraokeCaption.tsx. KaraokeCaption reçoit les timestamps ElevenLabs et met en évidence le mot courant à chaque frame. Tester dans Remotion Studio avec le JSON de test défini dans ARCHITECTURE.md. »

---

### Étape 4.3 — Lambda render + FFmpeg + Realtime

```
✅ Route POST /api/v1/pipeline/faceless/render
✅ renderMediaOnLambda() avec inputProps complets
✅ Polling getRenderProgress() → update projects.status dans Supabase
✅ Supabase Realtime → browser affiche player automatiquement
✅ POST /mix-audio sur Render : voix + musique avec ducking
✅ Upload MP4 final → Supabase Storage
✅ UPDATE projects SET output_url, status='done'
```

---

### Étape 4.4 — Re-render partiel par scène

```
✅ Si scène modifiée : relancer uniquement fal.ai → Kling → Remotion pour cette scène
✅ Remotion reçoit la liste clips avec la scène mise à jour uniquement
✅ Indicateur "Scène X mise à jour, re-rendu en cours..."
```

---

### Étape 4.5 — Player + export + edge cases

```
✅ Player vidéo inline avec contrôles
✅ Téléchargement MP4 (9:16 et 16:9)
✅ Email Resend si tab_active = false quand rendu terminé
✅ Gestion erreurs : timeout fal.ai, Lambda cold start, dépassement audio
✅ Fallback flux/schnell si fal.ai timeout > 30s
```

**Milestone S9 — Feature 1 live :**
> Première vidéo faceless complète générée end-to-end. Ouvrir à 20 beta-testeurs. Surveiller image_regenerated rate (cible < 30%).

---

## Phase 5 — F2 — Storyboard et composants Remotion (S10–S11)

### Étape 5.1 — Prompt system Claude Motion Director

```
✅ Prompt system F2 dans apps/api/prompts/f2-motion-director.txt
✅ Liste EXHAUSTIVE des SceneType et AnimationType dans le prompt
✅ Claude ne peut jamais inventer de types non listés
✅ Tester sur 10 briefs de secteurs différents
✅ Valider : 0 type invalide, total_frames ≈ durée_target × 30
```

**Prompt Claude Code :**
> « Crée le prompt system Motion Director F2. Il doit retourner un JSON storyboard typé (voir ARCHITECTURE.md section 5.3). La liste des types valides est exhaustive dans le prompt. Tester avec le brief "casque audio premium, 30s, format 9:16, style tech minimal". »

---

### Étape 5.2 — Composants Remotion motion design

```
✅ remotion/components/TextHero.tsx
✅ remotion/components/SplitTextImage.tsx
✅ remotion/components/ProductShowcase.tsx
✅ remotion/components/StatsCounter.tsx
✅ remotion/components/CtaEnd.tsx
✅ remotion/components/ImageFull.tsx
✅ Chaque composant : spring() + interpolate() Remotion pour animations
✅ Tester chaque composant isolément dans Remotion Studio
```

---

### Étape 5.3 — UI brief F2 + prévisualisation storyboard

```
✅ app/(dashboard)/motion/new/page.tsx
✅ Formulaire brief avec aide contextuelle par champ
✅ Upload logo (PNG/SVG) avec normalisation Sharp
✅ Affichage storyboard en slides miniatures
✅ Édition texte inline par slide
✅ Modification type de scène (liste déroulante des types valides)
✅ Réutilise architecture UI de F1 adaptée
```

---

## Phase 6 — F2 — Assets, audio et rendu final (S12–S13)

### Étape 6.1 — Assets fal.ai avec sélection modèle

```
✅ Seulement les scènes avec fal_prompt déclenchent fal.ai
✅ MODEL_MAP : sélection automatique par scene.fal_model (ARCHITECTURE.md 5.4)
✅ Preview-first : flux/schnell → flux-pro
✅ Vérification contrast ratio WCAG après chaque image
✅ Alerte UI si contrast < 4.5:1 avec suggestion correction
✅ Upload logo + Sharp normalisation + rembg si fond blanc parasite
```

---

### Étape 6.2 — ElevenLabs + recalcul timing F2

```
✅ Réutilise ElevenLabs wrapper de Phase 0
✅ Recalcul duration_frames si audio > slot (voir ARCHITECTURE.md 5.5)
✅ Si dépassement > 3s : Claude propose réécriture texte plus court
✅ UPDATE storyboard.total_frames dans Supabase
```

---

### Étape 6.3 — Remotion DynamicComposition + Lambda

```
✅ remotion/MotionVideo.tsx : DynamicComposition (voir ARCHITECTURE.md 5.6)
✅ renderMediaOnLambda() avec composition: 'MotionVideo'
✅ inputProps : storyboard JSON complet mis à jour
✅ Réutilise toute la chaîne Lambda + FFmpeg de F1
✅ FFmpeg génère aussi thumbnail JPEG (frame à t=3s)
✅ Export MP4 + thumbnail téléchargeables
```

**Milestone S13 — Feature 2 live :**
> F2 réutilise 65% de l'infra F1. Le delta est : prompt system Motion Director + 6 composants Remotion + recalcul timing + sélection modèle par type.

---

## Phase 7 — F3 — Brief, directions créatives et logos (S14–S15)

### Étape 7.1 — Prompt systems Claude F3 (2 prompts)

```
✅ apps/api/prompts/f3-brand-analyst.txt
   → Validation brief, contradictions, WCAG, archétype
   → JSON strict avec brief_quality, contradictions, wcag_issues
✅ apps/api/prompts/f3-creative-director.txt
   → 3 directions radicalement différentes
   → palette HEX, Google Fonts, mood, logo_prompt recraft-v3
   → Tester sur 15 briefs de secteurs différents
```

---

### Étape 7.2 — UI brief F3 + validation

```
✅ app/(dashboard)/brand/new/page.tsx
✅ Formulaire guidé avec aide contextuelle par champ
✅ Vérification WCAG inline sur les couleurs saisies (alerte immédiate)
✅ Si brief_quality = needs_clarification : modal avec questions avant de continuer
✅ Si wcag_issues : alerte inline avec alternatives conformes
```

---

### Étape 7.3 — Logos × 3 avec recraft-v3

```
✅ 3 appels fal.ai recraft-v3 en parallèle (mode vector_illustration)
✅ JAMAIS le nom de marque dans les prompts (voir ARCHITECTURE.md section 6.3)
✅ Nom superposé en CSS avec vraie Google Font
✅ Affichage logo sur 3 fonds : blanc, couleur primaire, noir
✅ rembg automatique si fond blanc parasite détecté
```

---

### Étape 7.4 — UI sélection direction + hybridation

```
✅ 3 cards : logo, palette visuelle, specimen typographique live (Google Fonts),
  5 adjectifs mood
✅ Interface hybridation : quelle palette / quelle typo / quel logo
✅ Si hybride : Claude génère JSON cohérent → nouveau call recraft-v3
✅ Style anchor défini dès validation de la direction
```

---

## Phase 8 — F3 — Assets, charte PDF et export (S15–S17)

### Étape 8.1 — Assets × 8-12 en batches de 4

```
✅ Ordre fixe : logo variantes → mockups studio → mockups lifestyle →
  patterns → illustrations
✅ Style anchor injecté dans chaque prompt fal.ai
✅ Batches de 4 (rate limit fal.ai)
✅ BRAND_MODEL_MAP : recraft-v3, rembg, flux-pro-ultra, flux-pro, flux/dev
✅ UI galerie : validation par asset, régénération individuelle, zoom
```

---

### Étape 8.2 — Charte graphique Markdown + PDF Puppeteer

```
✅ apps/api/prompts/f3-brand-charter.txt
✅ Sections fixes : logo_usage, colors, typography, grid, photography, do_dont
✅ URLs assets Supabase injectées dans le Markdown
✅ POST /generate-pdf sur Render : Puppeteer → stream PDF → Supabase Storage
✅ Pas de buffer mémoire : stream direct vers Supabase signed URL
```

**Prompt Claude Code :**
> « Crée le service Puppeteer sur Render (services/puppeteer.ts). Il reçoit le Markdown de la charte + CSS brandé + signed URL Supabase. Puppeteer charge le HTML (avec les images depuis Supabase), génère le PDF A4 avec printBackground:true, et le streame directement vers Supabase sans passer par la mémoire du serveur. »

---

### Étape 8.3 — Export ZIP + Resend email

```
✅ ZIP avec archiver en streaming vers Supabase (pas de buffer mémoire)
✅ Contenu : logos PNG (3 fonds × 3 tailles), palette.json + palette.ase,
  tous les mockups, charter.pdf, README.md
✅ Lien de partage Supabase avec expiration configurable
✅ Email Resend avec lien téléchargement quand ZIP prêt
```

**Milestone S17 — Feature 3 live :**
> Les 3 features sont complètes. Passer immédiatement à la Phase Launch.

---

## Phase 9 — Launch — Billing, onboarding, analytics (S17–S18)

### Étape 9.1 — Stripe + Moneroo

```
✅ Tables billing Supabase : subscriptions (si non créées en Phase 0)
✅ Stripe customer créé silencieusement à l'inscription
✅ Stripe Checkout Session côté serveur uniquement
✅ 5 webhooks Stripe (voir ARCHITECTURE.md section 9.2)
✅ Stripe Customer Portal (0 code UI billing à écrire)
✅ Middleware quota : vérification plan + usage avant chaque génération
✅ Moneroo : createMonerooPayment + webhook vérification signature
✅ UI modale "quota atteint" avec CTA upgrade → Stripe Checkout
```

**Prompt Claude Code :**
> « Implémente le système de billing complet (ARCHITECTURE.md sections 9.1 et 9.2). Stripe Checkout côté serveur, 5 webhooks avec vérification signature stripe.webhooks.constructEvent(), Customer Portal, et middleware quota (middleware/quota.ts). Jamais de logique billing côté frontend. »

---

### Étape 9.2 — Onboarding

```
✅ Page /welcome avec question d'usage (créateur / marketer / agence)
✅ Projets exemples pré-générés en base Supabase (vrais projets, pas des mocks)
   - Créateur → F1 "5 faits sur l'espace" (images déjà générées)
   - Marketer → F2 "Ad casque audio" (storyboard prêt + previews flux/schnell)
   - Agence → F3 "Volta" (3 directions affichées)
✅ Empty states actionnables sur /dashboard
✅ Tooltips contextuels (max 4 par feature, non répétés)
✅ 3 emails Resend automatiques (bienvenue, vidéo prête, relance J+7)
```

---

### Étape 9.3 — Analytics Posthog + rate limiting

```
✅ Posthog EU cloud initialisé (person_profiles: 'identified_only')
✅ Events critiques côté serveur (posthog-node) : voir ARCHITECTURE.md 10.2
✅ Alerte Posthog : render_failed > 5% sur 1h
✅ Alerte Posthog : image_regenerated rate > 40% sur 24h
✅ Rate limiting Upstash Redis sur endpoints génération
✅ Vues SQL Supabase pour métriques business (mrr_by_plan)
✅ Dashboard Posthog avec 5 métriques North Star uniquement
```

---

### Étape 9.4 — Vérifications pré-lancement

```
✅ Test flux complet F1 : inscription → première vidéo → téléchargement
✅ Test flux complet F2 : brief → motion design → téléchargement
✅ Test flux complet F3 : brief → brand kit → ZIP téléchargeable
✅ Test paiement Stripe (mode test) → quota mis à jour
✅ Test paiement Moneroo (mode test)
✅ Test emails Resend (3 templates)
✅ Test OAuth Google
✅ Vérifier RLS Supabase (aucun accès cross-user possible)
✅ Vérifier CORS (seul app.clyro.ai autorisé)
✅ Variables d'env en production (pas de clés de dev)
✅ Stripe en mode live
✅ Lambda Remotion warm-up cron actif
✅ HMAC inter-services configuré sur Render
```

**Milestone S18 — Launch public :**
> Clyro est en production avec les 3 features, le billing Stripe + Moneroo, et l'onboarding. Objectif : 50 beta users dans les 2 premières semaines pour valider la qualité des outputs.

---

## Commandes utiles

```bash
# Dev local
cd apps/web && npm run dev          # Frontend :3000
cd apps/api && npm run dev          # Backend :4000
npx remotion studio                 # Remotion Studio :3001

# Tests
cd apps/api && npm run test         # Jest unitaires + intégration
cd apps/web && npm run test         # React Testing Library

# Build
cd apps/web && npm run build        # Vérifie erreurs TypeScript
cd apps/api && npm run build        # Compile TypeScript

# Supabase
supabase start                      # Docker local
supabase db push                    # Appliquer migrations
supabase gen types typescript       # Générer types TS depuis DB

# Remotion
npx remotion lambda functions deploy        # Déployer fonction Lambda
npx remotion lambda sites create --site-name=clyro-video  # Déployer compositions

# Déploiement
git push origin main                # → Vercel + Render auto-deploy
```

# PLAN.md — Plan de développement CLYRO

**Méthodologie :** Sprints de 1 semaine
**Outil IA :** Claude Code (VS Code extension)
**Objectif :** MVP fonctionnel + déployé en production

---

## Résumé des phases

| Phase | Description | Durée estimée |
|-------|-------------|---------------|
| **Phase 0** | Setup & fondations | 2-3 jours |
| **Phase 1** | Auth + Dashboard squelette | 3-4 jours |
| **Phase 2** | Pipeline Faceless Videos | 5-7 jours |
| **Phase 3** | Paiements (Stripe + Moneroo) | 2-3 jours |
| **Phase 4** | Module Motion Graphics | 4-5 jours |
| **Phase 5** | Polish + emails + tests | 3-4 jours |
| **Phase 6** | Déploiement production | 1-2 jours |

---

## Phase 0 — Setup & Fondations

### Étape 0.1 — Repository GitHub
```
✅ Créer repo GitHub : clyro (privé)
✅ Structure monorepo : apps/web, apps/api, packages/shared
✅ .gitignore, .env.example
✅ README.md basique
```

**Dis à Claude Code :**
> « Initialise un monorepo Node.js avec la structure suivante : apps/web (Next.js 14), apps/api (Express + TypeScript), packages/shared (types partagés). Ajoute les .gitignore appropriés et un .env.example complet basé sur ARCHITECTURE.md. »

---

### Étape 0.2 — Next.js Frontend
```
✅ npx create-next-app@latest apps/web --typescript --tailwind --app
✅ Installer shadcn/ui : npx shadcn@latest init
✅ Installer dépendances : @supabase/auth-helpers-nextjs, lucide-react
✅ Configurer tailwind.config.ts avec les couleurs CLYRO
✅ Créer lib/supabase.ts (client Supabase)
✅ Créer app/globals.css avec les variables CSS CLYRO
```

**Dis à Claude Code :**
> « Dans apps/web, configure Tailwind avec le design system CLYRO (voir CLAUDE.md section Design System). Crée lib/supabase.ts avec le client Supabase browser-side. Ajoute les polices Google Fonts (Syne, DM Sans, JetBrains Mono) dans app/layout.tsx. »

---

### Étape 0.3 — Node.js Backend
```
✅ Initialiser apps/api : npm init, TypeScript, Express
✅ Structure dossiers : routes/, services/, middleware/
✅ Configurer nodemon + ts-node pour le dev
✅ Route GET /api/v1/health fonctionnelle
✅ Middleware CORS (autoriser app.clyro.app)
✅ Middleware auth (vérification JWT Supabase)
```

**Dis à Claude Code :**
> « Dans apps/api, configure un serveur Express TypeScript avec : middleware CORS, middleware d'authentification JWT Supabase (voir ARCHITECTURE.md section 3.2), route /api/v1/health, et gestion d'erreurs globale. »

---

### Étape 0.4 — Supabase Setup
```
✅ Créer projet Supabase sur supabase.com
✅ Exécuter migrations SQL (profiles, videos, cloned_voices, payments)
✅ Activer RLS sur toutes les tables
✅ Créer politiques RLS (voir ARCHITECTURE.md section 6.1)
✅ Créer Storage buckets : videos/, voice-samples/, brand-assets/
✅ Configurer Auth : activer Email, Google OAuth, Apple
```

**Dis à Claude Code :**
> « Génère les fichiers de migration Supabase dans supabase/migrations/ pour créer les tables profiles, videos, cloned_voices et payments avec les bonnes contraintes, RLS activé, et les politiques de sécurité définies dans ARCHITECTURE.md. »

---

## Phase 1 — Authentification & Dashboard

### Étape 1.1 — Pages Auth (Next.js)
```
✅ app/(auth)/login/page.tsx
✅ app/(auth)/signup/page.tsx
✅ Composants : LoginForm, SignupForm, SocialAuthButtons
✅ Google OAuth (redirect vers Supabase)
✅ Apple Sign-In (redirect vers Supabase)
✅ Callback OAuth : app/api/auth/callback/route.ts
✅ Middleware Next.js (protection routes dashboard)
```

**Dis à Claude Code :**
> « Crée les pages d'authentification Next.js (login + signup) en suivant le design system CLYRO. Utilise @supabase/auth-helpers-nextjs pour gérer les sessions. La page signup doit avoir : formulaire email/password, bouton Google OAuth, bouton Apple, onglet SSO (désactivé pour MVP). Applique les couleurs navy/blue/purple de CLAUDE.md. »

---

### Étape 1.2 — Dashboard squelette
```
✅ app/(dashboard)/layout.tsx : sidebar + header
✅ app/(dashboard)/dashboard/page.tsx : stats + CTA modules
✅ Composants Sidebar : navigation, avatar utilisateur, crédits restants
✅ Hook useUser() : récupère le profil Supabase
✅ Hook useCredits() : crédits disponibles
```

**Dis à Claude Code :**
> « Crée le layout dashboard avec une sidebar de navigation CLYRO. La sidebar doit afficher : logo CLYRO, liens (Dashboard, Faceless Videos, Motion Graphics, Historique, Voix, Paramètres), les crédits restants de l'utilisateur, et son avatar. Utilise le design system défini dans CLAUDE.md. »

---

## Phase 2 — Pipeline Faceless Videos

### Étape 2.1 — Interface de création (Frontend)
```
✅ app/(dashboard)/faceless/new/page.tsx
✅ Wizard multi-étapes :
   - Step 1 : Choix entrée (Script ou Audio)
   - Step 2 : Script → Choix voix / Audio → Upload
   - Step 3 : Choix style (6 styles avec preview)
   - Step 4 : Génération + affichage scènes/prompts
   - Step 5 : Preview vidéo + téléchargement
✅ Composants : StyleSelector, VoiceSelector, SceneEditor, ProgressTracker
```

**Dis à Claude Code :**
> « Crée le wizard de création Faceless Videos en 5 étapes. Étape 1 : deux boutons (Script ou Audio). Étape 3 : grille des 6 styles avec image preview et description. Étape 4 : affichage de chaque scène générée avec son prompt éditable et bouton "Régénérer cette scène". Utilise shadcn/ui pour les composants. »

---

### Étape 2.2 — Service Claude AI (Backend)
```
✅ services/claude.ts : fonction generateStoryboard()
✅ Prompt optimisé : découpage en scènes, JSON structuré
✅ Gestion des erreurs API Anthropic
✅ Retry automatique (3 tentatives)
✅ Logging des tokens utilisés
```

**Dis à Claude Code :**
> « Dans apps/api/services/claude.ts, crée la fonction generateStoryboard(script, style, sceneCount) qui appelle l'API Anthropic claude-sonnet-4-6. Elle doit retourner un tableau de scènes avec : description_visuelle (en anglais pour fal.ai), texte_voix, duree_estimee. Ajoute retry logic et logging. »

---

### Étape 2.3 — Service ElevenLabs (Backend)
```
✅ services/elevenlabs.ts
✅ Fonction generateVoiceover(text, voiceId) → Buffer audio MP3
✅ Fonction generateVoiceoverScenes(scenes[], voiceId) → MP3 par scène
✅ Fonction listPublicVoices() → liste voix disponibles
✅ Fonction cloneVoice(audioBuffer, name) → voiceId ElevenLabs
✅ Gestion quota et erreurs API
```

**Dis à Claude Code :**
> « Crée services/elevenlabs.ts avec les fonctions de TTS et clonage vocal. Pour le TTS, utilise le modèle eleven_multilingual_v2. Pour le clonage, utilise l'API Add Voice de ElevenLabs. Toutes les fonctions doivent gérer les erreurs et logger les appels. »

---

### Étape 2.4 — Service fal.ai (Backend)
```
✅ services/fal.ts
✅ Fonction generateImage(prompt, style) → URL image
✅ Mapping style CLYRO → modèle fal.ai + prefix/suffix prompt
✅ Gestion timeout (max 30s par image)
✅ Retry sur erreur 500/timeout
```

**Dis à Claude Code :**
> « Crée services/fal.ts pour générer des images avec fal.ai. Utilise le modèle fal-ai/flux/schnell. La fonction generateSceneImage(prompt, style) doit ajouter le prefix/suffix de style défini dans ARCHITECTURE.md section 4.3. Timeout 30s, retry 2x. »

---

### Étape 2.5 — Service FFmpeg (Backend)
```
✅ services/ffmpeg.ts
✅ Fonction loopClipToDuration(clip, duration) → clip loopé
✅ Fonction concatenateClips(clips[]) → vidéo concaténée
✅ Fonction mixAudio(video, voiceover, music) → vidéo finale
✅ Fonction addSubtitles(video, scenes[]) → avec overlays texte
✅ Fonction assembleVideo(scenes, audio, options) → MP4 final
```

**Dis à Claude Code :**
> « Crée services/ffmpeg.ts avec toutes les fonctions d'assemblage vidéo. Utilise child_process.spawn pour appeler ffmpeg. La fonction assembleVideo doit orchestrer : loop des clips à la durée de scène, concat, mix avec voix off (volume 100%) et musique de fond (volume 15%), et optionnellement ajouter les overlays texte. »

---

### Étape 2.6 — Route Pipeline (Backend)
```
✅ routes/pipeline/faceless.ts
✅ POST /api/v1/pipeline/faceless : lance le pipeline complet
✅ POST /api/v1/pipeline/faceless/scene : régénère une scène
✅ Orchestration : Claude → fal.ai → ElevenLabs → FFmpeg → Supabase
✅ Mise à jour status en base à chaque étape
✅ Upload MP4 final vers Supabase Storage
✅ SSE status : GET /api/v1/videos/:id/status
```

**Dis à Claude Code :**
> « Crée la route POST /api/v1/pipeline/faceless qui orchestre tout le pipeline. Elle doit : créer l'entrée video en DB (status:pending), lancer le pipeline en arrière-plan (pas bloquer la réponse), mettre à jour le status en DB à chaque étape (storyboard, visuals, audio, assembly, done), uploader le MP4 vers Supabase Storage, retourner immédiatement { videoId } au client. »

---

## Phase 3 — Paiements

### Étape 3.1 — Stripe
```
✅ services/stripe.ts : createCheckoutSession, handleWebhook
✅ Route POST /api/v1/checkout/stripe
✅ Route POST /webhook/stripe (signature verification)
✅ Handler : checkout.session.completed → update profile plan + credits
✅ Handler : customer.subscription.deleted → downgrade to free
✅ Page /settings/billing sur le frontend
```

**Dis à Claude Code :**
> « Intègre Stripe dans apps/api. Crée la session checkout avec les prix définis dans PRD.md. Implémente le webhook avec vérification de signature Stripe (stripe.webhooks.constructEvent). Sur paiement réussi, met à jour le champ plan et credits du profil Supabase. »

---

### Étape 3.2 — Moneroo
```
✅ services/moneroo.ts : createPayment, handleWebhook
✅ Route POST /api/v1/checkout/moneroo
✅ Route POST /webhook/moneroo (vérification signature)
✅ Handler succès → update profile plan + credits
✅ UI : bouton "Payer avec Mobile Money" + champ numéro téléphone
```

**Dis à Claude Code :**
> « Intègre Moneroo Mobile Money dans apps/api. L'API Moneroo est similaire à Stripe mais pour l'Afrique de l'Ouest. Crée la fonction createMonerooPayment(userId, plan, phoneNumber, currency='XOF') et le handler webhook. Voir ARCHITECTURE.md section 7.2 pour le code de référence. »

---

## Phase 4 — Module Motion Graphics

### Étape 4.1 — Interface Motion (Frontend)
```
✅ app/(dashboard)/motion/new/page.tsx
✅ Wizard :
   - Step 1 : Brief + objectif + format + durée
   - Step 2 : Upload identité de marque (logo, couleurs, police)
   - Step 3 : Style (Corporate, Dynamique, Luxe, Fun)
   - Step 4 : Génération + édition prompts par scène
   - Step 5 : Voix off optionnelle
   - Step 6 : Preview + téléchargement
```

---

### Étape 4.2 — Remotion Setup (Backend)
```
✅ Installer @remotion/renderer dans apps/api
✅ Créer apps/api/remotion/compositions/BrandOverlay.tsx
✅ Fonction renderMotionVideo(scenes, brandConfig) → MP4
✅ Composition React : fond visuel + overlay marque + animations
```

**Dis à Claude Code :**
> « Configure Remotion dans apps/api pour le rendu serveur-side. Crée la composition BrandOverlay.tsx qui prend : images de fond (fal.ai), couleurs de marque, logo, et génère une vidéo MP4 avec le timing de chaque scène. Utilise @remotion/renderer pour le rendu côté serveur sans browser. »

---

## Phase 5 — Polish & Emails

### Étape 5.1 — Emails transactionnels (Resend)
```
✅ services/resend.ts
✅ Email : confirmation d'inscription
✅ Email : vidéo prête (avec lien de téléchargement)
✅ Email : confirmation de paiement
✅ Email : bienvenue après premier paiement
✅ Templates HTML au design CLYRO
```

**Dis à Claude Code :**
> « Crée les templates d'emails HTML pour Resend. Chaque email doit respecter la charte CLYRO (fond #060810, accent #3B8EF0, police Syne pour les titres). Crée : email de bienvenue, email "votre vidéo est prête" avec bouton de téléchargement, email de confirmation de paiement. »

---

### Étape 5.2 — Historique des vidéos
```
✅ app/(dashboard)/history/page.tsx
✅ Liste paginée des vidéos (10 par page)
✅ Status badge (En cours / Terminé / Erreur)
✅ Preview thumbnail
✅ Actions : Télécharger, Re-générer, Supprimer
```

---

### Étape 5.3 — Gestion des voix clonées
```
✅ app/(dashboard)/voices/page.tsx
✅ Liste des voix personnelles
✅ Upload nouvel échantillon + formulaire de clonage
✅ Preview audio de la voix clonée
✅ Suppression
```

---

## Phase 6 — Déploiement Production

### Étape 6.1 — Vercel (Frontend)
```
✅ Connecter repo GitHub à Vercel
✅ Root directory : apps/web
✅ Framework : Next.js
✅ Variables d'environnement : NEXT_PUBLIC_*
✅ Domaine custom : app.clyro.app
✅ Build command : npm run build
```

---

### Étape 6.2 — Render (Backend)
```
✅ Créer Web Service sur Render
✅ Root directory : apps/api
✅ Build command : npm run build
✅ Start command : npm start
✅ Plan : Starter ($7/mois)
✅ Variables d'environnement complètes
✅ Région : Frankfurt (EU)
✅ Health check : /api/v1/health
```

---

### Étape 6.3 — Vérifications pré-lancement
```
✅ Test flux complet : inscription → première vidéo → téléchargement
✅ Test paiement Stripe (mode test)
✅ Test paiement Moneroo (mode test)
✅ Test emails Resend
✅ Test OAuth Google
✅ Vérifier RLS Supabase
✅ Vérifier CORS (seul app.clyro.app autorisé)
✅ Variables d'env en production (pas de clés de dev)
✅ Stripe en mode live
✅ ElevenLabs quota suffisant
```

---

## Commandes utiles

```bash
# Dev local
cd apps/web && npm run dev          # Frontend port 3000
cd apps/api && npm run dev          # Backend port 4000

# Tests
npm run test                        # Tests unitaires
npm run test:e2e                    # Tests end-to-end

# Build
cd apps/web && npm run build        # Build Next.js
cd apps/api && npm run build        # Compile TypeScript

# Supabase migrations
supabase db push                    # Appliquer migrations
supabase gen types typescript       # Générer types TS depuis DB

# Déploiement
git push origin main                # → Trigger Vercel auto-deploy
                                   # → Trigger Render auto-deploy
```

# CLAUDE.md — Contexte complet du projet CLYRO

> Ce fichier est lu automatiquement par Claude Code à chaque session.
> Il contient tout le contexte nécessaire pour travailler sur ce projet sans répéter les instructions.

---

## Qu'est-ce que CLYRO ?

**CLYRO** est une plateforme SaaS de génération vidéo et d'identité visuelle par IA, destinée aux créateurs de contenu, équipes marketing et agences. Elle permet de produire des vidéos professionnelles et des identités de marque complètes sans compétences techniques.

**Trois modules :**
1. **Faceless Videos** — Vidéos YouTube/TikTok/Instagram avec personnages animés (style Tikman, Monkey Mind) — 6 styles visuels
2. **Motion Design** — Publicités animées style After Effects, présentations produit, contenus marketing
3. **Brand Kit** — Identité visuelle complète et charte graphique générée depuis un brief

**Public cible :**
- Créateurs YouTube/TikTok qui veulent scaler leur production
- Équipes marketing ayant besoin de vidéos et de visuels sans agence
- Agences créatives cherchant à automatiser la production de brand kits
- Entrepreneurs africains (support Mobile Money via Moneroo)

---

## Stack technique

### Frontend
| Outil | Usage | Hébergement |
|-------|-------|-------------|
| **Next.js 14** (App Router) | Application principale | Vercel |
| **Tailwind CSS** | Styling | — |
| **shadcn/ui** | Composants UI | — |
| **React** | Framework UI | — |

### Backend
| Outil | Usage | Hébergement |
|-------|-------|-------------|
| **Node.js** (Express) | API REST / webhooks / orchestration pipelines | Render |
| **Supabase** | Auth + Base de données + Storage + Realtime | Supabase cloud |

### IA & Génération
| Outil | Usage |
|-------|-------|
| **Claude AI** (Anthropic, claude-sonnet-4-5) | Orchestrateur central — génère les instructions pour tous les autres services : storyboards, prompts image, JSON storyboard typé, directions créatives, charte graphique |
| **ElevenLabs** | Voix off (bibliothèque publique + clonage vocal) + word timestamps pour karaoke |
| **fal.ai** | Génération images GPU (flux-pro, flux/schnell, recraft-v3, ideogram-v2, kling-v1.5) + image-to-video + rembg |
| **Remotion** (Lambda) | Assemblage vidéo programmatique — composition React rendue sur AWS Lambda |
| **FFmpeg** | Post-processing audio (ducking, mix) + encode final H.264 + thumbnail |

### Paiement
| Outil | Usage |
|-------|-------|
| **Stripe** | Cartes bancaires internationales — Checkout + webhooks |
| **Moneroo** | Mobile Money Afrique (Orange Money, Wave, MTN, Moov) |

### Infrastructure & Services
| Outil | Usage |
|-------|-------|
| **GitHub** | Versioning, CI/CD |
| **Vercel** | Landing page + frontend Next.js |
| **Render** | Backend Node.js + service FFmpeg + service Puppeteer (PDF) |
| **AWS Lambda + S3** | Remotion Lambda — rendu vidéo serverless |
| **Resend** | Emails transactionnels (React Email templates) |
| **Posthog EU** | Analytics produit (RGPD-compliant) |
| **Upstash Redis** | Rate limiting sur les endpoints de génération |

---

## Structure du projet

```
clyro/
├── apps/
│   ├── web/                          # Next.js — Frontend (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx        # Sidebar + stepper persistant
│   │   │   │   ├── dashboard/        # Stats + CTA modules
│   │   │   │   ├── faceless/         # Module F1 Faceless Videos
│   │   │   │   │   └── new/          # Wizard création
│   │   │   │   ├── motion/           # Module F2 Motion Design
│   │   │   │   │   └── new/          # Wizard création
│   │   │   │   ├── brand/            # Module F3 Brand Kit
│   │   │   │   │   └── new/          # Wizard brand brief
│   │   │   │   ├── history/
│   │   │   │   ├── voices/
│   │   │   │   └── settings/
│   │   │   │       └── billing/
│   │   │   └── api/
│   │   │       └── auth/callback/    # OAuth callback Supabase
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui customisé charte CLYRO
│   │   │   ├── faceless/             # Composants wizard F1
│   │   │   ├── motion/               # Composants wizard F2
│   │   │   ├── brand/                # Composants wizard F3
│   │   │   └── shared/               # Stepper, ProgressTracker, SceneEditor
│   │   └── lib/
│   │       ├── supabase.ts
│   │       ├── api.ts                # Client HTTP vers backend
│   │       └── utils.ts
│   │
│   └── api/                          # Node.js — Backend (Render)
│       ├── routes/
│       │   ├── pipeline/
│       │   │   ├── faceless.ts       # Pipeline F1
│       │   │   ├── motion.ts         # Pipeline F2
│       │   │   └── brand.ts          # Pipeline F3
│       │   ├── voices.ts
│       │   ├── webhooks/
│       │   │   ├── stripe.ts
│       │   │   └── moneroo.ts
│       │   └── auth.ts
│       ├── services/
│       │   ├── claude.ts             # Wrapper Claude API (orchestrateur)
│       │   ├── elevenlabs.ts         # TTS + timestamps + clonage
│       │   ├── fal.ts                # GPU génération images/vidéos + retry
│       │   ├── remotion.ts           # Remotion Lambda client
│       │   ├── ffmpeg.ts             # Post-processing audio/vidéo
│       │   ├── puppeteer.ts          # PDF charte graphique
│       │   ├── stripe.ts
│       │   ├── moneroo.ts
│       │   └── resend.ts
│       ├── middleware/
│       │   ├── auth.ts               # JWT Supabase verification
│       │   ├── quota.ts              # Vérification plan + usage
│       │   └── hmac.ts               # Signature inter-services
│       └── index.ts
│
├── remotion/                         # Compositions React Remotion
│   ├── index.ts                      # Déclaration des compositions
│   ├── FacelessVideo.tsx             # Composition F1
│   ├── MotionVideo.tsx               # Composition F2 (DynamicComposition)
│   └── components/
│       ├── KaraokeCaption.tsx        # Sous-titres word-by-word
│       ├── TextHero.tsx
│       ├── SplitTextImage.tsx
│       ├── ProductShowcase.tsx
│       ├── StatsCounter.tsx
│       └── CtaEnd.tsx
│
├── packages/
│   └── shared/                       # Types TypeScript partagés
│       ├── types/
│       │   ├── video.ts
│       │   ├── scene.ts
│       │   ├── brand.ts
│       │   └── billing.ts
│
├── landing/                          # Pages marketing (HTML statique)
│   ├── index.html
│   ├── signup.html
│   └── login.html
│
├── docs/
│   ├── CLAUDE.md
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── PLAN.md
│   └── AI_RULES.md
│
└── supabase/
    └── migrations/
```

---

## Base de données Supabase

### Tables principales

```sql
-- Utilisateurs (étend auth.users)
profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users,
  full_name           text,
  avatar_url          text,
  plan                text DEFAULT 'starter',   -- starter | pro | entreprise
  status              text DEFAULT 'active',    -- active | past_due | canceled
  stripe_customer_id  text UNIQUE,
  stripe_subscription_id text UNIQUE,
  current_period_end  timestamptz,
  created_at          timestamptz DEFAULT now()
)

-- Usage mensuel par feature
usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id),
  feature      text CHECK (feature IN ('f1','f2','f3')),
  period_start date NOT NULL,
  count        integer DEFAULT 0,
  UNIQUE(user_id, feature, period_start)
)

-- Projets vidéo (F1 + F2)
projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES profiles(id),
  feature      text CHECK (feature IN ('f1','f2')),
  title        text,
  style        text,
  voice_id     text,
  status       text DEFAULT 'created',  -- created | processing | done | error
  output_url   text,
  thumbnail_url text,
  tab_active   boolean DEFAULT true,
  metadata     jsonb,
  created_at   timestamptz DEFAULT now()
)

-- Scènes (F1 + F2)
scenes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id),
  scene_index       integer,
  summary           text,
  text              text,
  image_prompt      text,
  animation_prompt  text,
  duration_estimate numeric,
  duration_frames   integer,
  image_url         text,
  image_quality     text,   -- draft | hd
  audio_url         text,
  audio_duration    numeric,
  timestamps_json   jsonb,
  clip_url          text,
  status            text DEFAULT 'pending'
)

-- Projets Brand Kit (F3)
brand_projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id),
  brand_name      text,
  brief           jsonb,
  direction       jsonb,   -- direction créative validée
  asset_urls      jsonb,   -- URLs de tous les assets générés
  charter_pdf_url text,
  brand_kit_url   text,    -- ZIP
  status          text DEFAULT 'brief',
  created_at      timestamptz DEFAULT now()
)

-- Voix clonées
cloned_voices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES profiles(id),
  name                 text,
  elevenlabs_voice_id  text,
  created_at           timestamptz DEFAULT now()
)

-- Transactions paiement
payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles(id),
  provider   text,   -- stripe | moneroo
  amount     numeric,
  currency   text,
  status     text,   -- pending | success | failed
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
)
```

---

## Authentification

- **Email/Password** → Supabase Auth
- **Google OAuth** → Supabase + Google Console
- **Apple Sign-In** → Supabase
- **SSO Entreprise** → SAML/SCIM (plan Entreprise uniquement)

Variables d'environnement côté frontend :
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_APP_URL=https://clyro.ai
```

---

## Design System CLYRO

### Couleurs
```css
--navy-950: #060810    /* Background principal */
--navy-900: #0A0D1A    /* Cards, panels */
--navy-800: #0F1427    /* Inputs, éléments */
--navy-700: #151C38    /* Hover states */

--blue-500:   #3B8EF0  /* Accent principal */
--purple-500: #9B5CF6  /* Accent secondaire */
--cyan-400:   #38E8FF  /* Accent tertiaire */

--grad-primary:  linear-gradient(135deg, #3B8EF0, #9B5CF6)
--grad-electric: linear-gradient(135deg, #38E8FF, #3B8EF0, #9B5CF6)
```

### Typographie
```css
--font-display: 'Syne', sans-serif         /* Titres, boutons, logo */
--font-body:    'DM Sans', sans-serif      /* Corps de texte */
--font-mono:    'JetBrains Mono', mono     /* Labels, badges, code */
```

### Règles design
- Fond noise texture overlay (opacity 0.4)
- Grille 48px en arrière-plan sur les sections clés
- Glow radial sur les CTA et sections hero
- Labels en `JetBrains Mono` UPPERCASE avec `::after` ligne décorative

---

## Variables d'environnement complètes

### Backend (Render)
```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# ElevenLabs
ELEVENLABS_API_KEY=sk_...

# fal.ai
FAL_KEY=...
FAL_KEY_ID=...
FAL_KEY_SECRET=...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AWS / Remotion Lambda
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-west-1
REMOTION_FUNCTION_NAME=remotion-render-4-0-0-mem2048mb-disk2048mb-240sec
REMOTION_SERVE_URL=https://s3.eu-west-1.amazonaws.com/...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Moneroo
MONEROO_API_KEY=...
MONEROO_WEBHOOK_SECRET=...

# Resend
RESEND_API_KEY=re_...

# Auth inter-services (HMAC Render ↔ Next.js)
RENDER_SERVICE_SECRET=...

# App
FRONTEND_URL=https://clyro.ai
BACKEND_URL=https://api.clyro.ai
NODE_ENV=production
PORT=4000
```

---

## Conventions de code

- **Language** : TypeScript strict (`strict: true` dans tsconfig)
- **Imports** : Absolus avec `@/` pour le frontend
- **Nommage** : camelCase variables, PascalCase composants, SCREAMING_SNAKE_CASE constantes
- **API** : Routes REST préfixées `/api/v1/`
- **Erreurs** : Toujours retourner `{ error: string, code: string }` en cas d'échec
- **Auth** : Vérifier le JWT Supabase sur chaque route protégée du backend
- **Async** : async/await partout, pas de `.then()/.catch()` chaîné
- **Fichiers** : kebab-case pour les noms de fichiers

---

## URLs de déploiement

| Environnement | Service | URL |
|---------------|---------|-----|
| Production | Landing (Vercel) | https://clyro.ai |
| Production | App Next.js (Vercel) | https://app.clyro.ai |
| Production | API Node.js (Render) | https://api.clyro.ai |
| Production | Render service (FFmpeg + Puppeteer) | https://render.clyro.ai |
| Dev local | Frontend | http://localhost:3000 |
| Dev local | Backend | http://localhost:4000 |

---

## Principe d'orchestration — Règle fondamentale

**Claude est le seul chef d'orchestre. Il ne génère jamais de médias lui-même.**

Il génère des instructions (JSON) pour les autres services :
- Prompts image optimisés → fal.ai
- Storyboards typés JSON → Remotion
- Directions créatives → fal.ai recraft-v3
- Charte graphique Markdown → Puppeteer

**Next.js est le seul intermédiaire.** Aucun service externe n'appelle un autre directement. Tout transite par les API Routes Next.js ou les routes backend. Cela permet le logging, retry et monitoring centralisés.

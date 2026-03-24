# CLAUDE.md — Contexte complet du projet CLYRO

> Ce fichier est lu automatiquement par Claude Code à chaque session.
> Il contient tout le contexte nécessaire pour travailler sur ce projet sans répéter les instructions.

---

## 🎯 Qu'est-ce que CLYRO ?

**CLYRO** est une plateforme SaaS de génération vidéo par IA, destinée aux créateurs de contenu et aux équipes marketing. Elle permet de produire des vidéos professionnelles sans caméra, sans monteur, sans agence.

**Deux modules :**
1. **Faceless Videos** — Vidéos YouTube/TikTok/Instagram sans apparaître à l'écran (6 styles)
2. **Motion Graphics** — Publicités animées, présentations produit, contenus marketing

**Public cible :**
- Créateurs YouTube/TikTok qui veulent scaler leur production
- Équipes marketing qui ont besoin de vidéos pub sans agence
- Entrepreneurs africains (support Mobile Money)

---

## 🛠️ Stack technique

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
| **Node.js** (Express ou Fastify) | API REST / webhooks | Render |
| **Supabase** | Auth + Base de données + Storage | Supabase cloud |

### IA & Génération
| Outil | Usage |
|-------|-------|
| **Claude AI** (Anthropic) | Génération storyboard, découpage scènes, prompts visuels |
| **ElevenLabs** | Voix off (bibliothèque publique + clonage vocal) |
| **fal.ai** | Génération images/vidéos GPU (Flux.1, AnimateDiff, Kling) |
| **Remotion** | Assemblage vidéo programmatique (Motion Graphics) |
| **FFmpeg** | Assemblage final, concat clips, mix audio |

### Paiement
| Outil | Usage |
|-------|-------|
| **Stripe** | Cartes bancaires internationales |
| **Moneroo** | Mobile Money Afrique (Orange Money, Wave, MTN, Moov) |

### Infrastructure & Services
| Outil | Usage |
|-------|-------|
| **GitHub** | Versioning, CI/CD |
| **Vercel** | Déploiement landing page + frontend Next.js |
| **Render** | Déploiement backend Node.js |
| **Resend** | Emails transactionnels |
| **Google Console** | OAuth Google |
| **Supabase Storage** | Stockage vidéos générées, assets utilisateurs |

---

## 📁 Structure du projet

```
clyro/
├── apps/
│   ├── web/                    # Next.js — Frontend (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── faceless/   # Module Faceless Videos
│   │   │   │   │   └── new/
│   │   │   │   ├── motion/     # Module Motion Graphics
│   │   │   │   │   └── new/
│   │   │   │   ├── history/
│   │   │   │   ├── voices/
│   │   │   │   └── settings/
│   │   │   └── api/            # Route handlers Next.js
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui
│   │   │   ├── faceless/       # Composants spécifiques Faceless
│   │   │   ├── motion/         # Composants spécifiques Motion
│   │   │   └── shared/
│   │   └── lib/
│   │       ├── supabase.ts
│   │       └── utils.ts
│   │
│   └── api/                    # Node.js — Backend (Render)
│       ├── routes/
│       │   ├── pipeline/
│       │   │   ├── faceless.ts
│       │   │   └── motion.ts
│       │   ├── voices.ts
│       │   ├── webhooks/
│       │   │   ├── stripe.ts
│       │   │   └── moneroo.ts
│       │   └── auth.ts
│       ├── services/
│       │   ├── claude.ts       # Appels Anthropic API
│       │   ├── elevenlabs.ts   # TTS + clonage vocal
│       │   ├── fal.ts          # GPU génération images/vidéos
│       │   ├── remotion.ts     # Assemblage Motion Graphics
│       │   └── ffmpeg.ts       # Assemblage final
│       └── index.ts
│
├── packages/
│   └── shared/                 # Types TypeScript partagés
│
├── landing/                    # Pages marketing (HTML statique)
│   ├── index.html
│   ├── signup.html
│   └── login.html
│
├── docs/                       # Ce dossier (fichiers de contexte)
│   ├── CLAUDE.md
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── PLAN.md
│   └── AI_RULES.md
│
└── supabase/
    └── migrations/             # Migrations SQL
```

---

## 🗄️ Base de données Supabase

### Tables principales

```sql
-- Utilisateurs (étend auth.users)
profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users,
  full_name   text,
  avatar_url  text,
  plan        text DEFAULT 'free',   -- free | starter | studio
  credits     int  DEFAULT 3,
  created_at  timestamptz DEFAULT now()
)

-- Vidéos générées
videos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id),
  module      text,         -- faceless | motion
  style       text,
  title       text,
  status      text,         -- pending | processing | done | error
  output_url  text,
  metadata    jsonb,        -- scenes, prompts, voix utilisée...
  created_at  timestamptz DEFAULT now()
)

-- Bibliothèque de voix clonées
cloned_voices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id),
  name        text,
  elevenlabs_voice_id text,
  created_at  timestamptz DEFAULT now()
)

-- Transactions paiement
payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id),
  provider    text,         -- stripe | moneroo
  amount      numeric,
  currency    text,
  status      text,         -- pending | success | failed
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
)
```

---

## 🔐 Authentification

- **Email/Password** → Supabase Auth
- **Google OAuth** → Supabase + Google Console
- **Apple Sign-In** → Supabase
- **SSO Entreprise** → SAML/SCIM (plan Studio uniquement)

Variables d'environnement côté frontend :
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

---

## 🎨 Design System CLYRO

### Couleurs
```css
--navy-950: #060810   /* Background principal */
--navy-900: #0A0D1A   /* Cards, panels */
--navy-800: #0F1427   /* Inputs, éléments */
--navy-700: #151C38   /* Hover states */

--blue-500:   #3B8EF0  /* Accent principal */
--purple-500: #9B5CF6  /* Accent secondaire */
--cyan-400:   #38E8FF  /* Accent tertiaire */

--grad-primary:  linear-gradient(135deg, #3B8EF0, #9B5CF6)
--grad-electric: linear-gradient(135deg, #38E8FF, #3B8EF0, #9B5CF6)
```

### Typographie
```css
--font-display: 'Syne', sans-serif        /* Titres, boutons, logo */
--font-body:    'DM Sans', sans-serif     /* Corps de texte */
--font-mono:    'JetBrains Mono', mono    /* Labels, badges, code */
```

### Règles design
- Fond noise texture overlay (opacity 0.4)
- Grille 48px en arrière-plan sur les sections clés
- Glow radial sur les CTA et sections hero
- Labels en `JetBrains Mono` UPPERCASE avec `::after` ligne décorative

---

## ⚙️ Variables d'environnement (Backend)

```env
# Anthropic
ANTHROPIC_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# fal.ai
FAL_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Moneroo
MONEROO_API_KEY=
MONEROO_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# URLs
FRONTEND_URL=https://clyro.app
BACKEND_URL=https://api.clyro.app
```

---

## 📝 Conventions de code

- **Language** : TypeScript strict (`strict: true` dans tsconfig)
- **Imports** : Absolus avec `@/` pour le frontend
- **Nommage** : camelCase variables, PascalCase composants, SCREAMING_SNAKE_CASE constantes
- **API** : Routes REST préfixées `/api/v1/`
- **Erreurs** : Toujours retourner `{ error: string, code: string }` en cas d'échec
- **Auth** : Vérifier le JWT Supabase sur chaque route protégée du backend
- **Async** : async/await partout, pas de .then()/.catch() chaîné
- **Fichiers** : kebab-case pour les noms de fichiers

---

## 🔗 URLs de déploiement

| Environnement | Service | URL |
|---------------|---------|-----|
| Production | Landing (Vercel) | https://clyro.app |
| Production | App Next.js (Vercel) | https://app.clyro.app |
| Production | API Node.js (Render) | https://api.clyro.app |
| Dev local | Frontend | http://localhost:3000 |
| Dev local | Backend | http://localhost:4000 |

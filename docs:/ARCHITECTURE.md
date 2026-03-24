# ARCHITECTURE.md — Architecture technique CLYRO

**Version :** 1.0
**Date :** Mars 2026

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│                          UTILISATEUR                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
          ┌────────────────────▼────────────────────┐
          │                                          │
   ┌──────▼──────┐                         ┌────────▼────────┐
   │  VERCEL     │                         │    VERCEL       │
   │  Landing    │                         │  App Next.js    │
   │  clyro.app  │                         │ app.clyro.app   │
   └─────────────┘                         └────────┬────────┘
                                                    │ API calls
                                           ┌────────▼────────┐
                                           │    RENDER       │
                                           │  Node.js API    │
                                           │ api.clyro.app   │
                                           └────┬───┬───┬────┘
                                                │   │   │
                    ┌───────────────────────────┘   │   └──────────────┐
                    │                               │                  │
           ┌────────▼───────┐            ┌──────────▼──────┐  ┌───────▼──────┐
           │   SUPABASE     │            │   SERVICES IA   │  │  PAIEMENTS   │
           │  Auth + DB     │            │ Claude/ElevenLab│  │Stripe/Moneroo│
           │  + Storage     │            │  fal.ai/FFmpeg  │  └──────────────┘
           └────────────────┘            └─────────────────┘
```

---

## 2. Frontend — Next.js (Vercel)

### 2.1 Architecture App Router

```
app/
├── (marketing)/            # Groupe de routes publiques
│   ├── page.tsx            # Landing page (ou redirect vers landing HTML)
│   └── layout.tsx
│
├── (auth)/                 # Routes d'authentification
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── layout.tsx
│
├── (dashboard)/            # Routes protégées (auth requise)
│   ├── layout.tsx          # Sidebar + header commun
│   ├── dashboard/page.tsx  # Vue d'ensemble + stats
│   ├── faceless/
│   │   ├── page.tsx        # Liste projets Faceless
│   │   └── new/
│   │       └── page.tsx    # Wizard création Faceless
│   ├── motion/
│   │   ├── page.tsx        # Liste projets Motion
│   │   └── new/
│   │       └── page.tsx    # Wizard création Motion
│   ├── history/page.tsx    # Historique complet
│   ├── voices/page.tsx     # Gestion voix clonées
│   └── settings/
│       ├── page.tsx
│       └── billing/page.tsx
│
└── api/                    # Route Handlers Next.js (léger, auth check)
    └── auth/
        └── callback/route.ts   # OAuth callback Supabase
```

### 2.2 Middleware d'authentification

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Redirection si non authentifié sur routes protégées
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect('/login')
  }
  return res
}
```

### 2.3 Communication Frontend → Backend

Toutes les requêtes IA/génération passent par le backend Node.js (Render), pas directement depuis le frontend :

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL

export async function startFacelessGeneration(payload: FacelessPayload) {
  const session = await getSupabaseSession()
  return fetch(`${API_URL}/api/v1/pipeline/faceless`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
```

---

## 3. Backend — Node.js (Render)

### 3.1 Structure des routes

```
POST   /api/v1/pipeline/faceless          # Lance pipeline Faceless
POST   /api/v1/pipeline/faceless/scene    # Régénère une scène
POST   /api/v1/pipeline/motion            # Lance pipeline Motion
POST   /api/v1/pipeline/motion/scene      # Régénère une scène Motion
GET    /api/v1/videos                     # Liste vidéos utilisateur
GET    /api/v1/videos/:id                 # Détail + status
DELETE /api/v1/videos/:id                 # Suppression

POST   /api/v1/voices/clone               # Clone une voix
GET    /api/v1/voices                     # Liste voix (publiques + perso)
DELETE /api/v1/voices/:id                 # Supprime voix clonée

POST   /api/v1/checkout/stripe            # Crée session Stripe
POST   /api/v1/checkout/moneroo           # Crée paiement Moneroo
POST   /webhook/stripe                    # Webhook Stripe (pas de /api/v1)
POST   /webhook/moneroo                   # Webhook Moneroo

GET    /api/v1/health                     # Health check
```

### 3.2 Middleware d'authentification Backend

```typescript
// middleware/auth.ts
import { createClient } from '@supabase/supabase-js'

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  req.user = user
  next()
}
```

---

## 4. Pipeline Faceless Videos

### 4.1 Flux de données

```
Client                    Backend (Node.js)              Services externes
  │                              │                              │
  ├─ POST /pipeline/faceless ───►│                              │
  │   { script, style, voice }   │                              │
  │                              ├─ createVideo(status:pending) │
  │                              │   → Supabase DB              │
  │                              │                              │
  │◄─ { videoId, jobId } ────────┤                              │
  │                              │                              │
  │  (polling ou SSE)            ├─ Claude AI: storyboard ─────►│
  │                              │◄─ scenes[] ─────────────────┤
  │                              │                              │
  │◄─ { scenes, prompts } ───────┤ (affichage prompts côté UI) │
  │                              │                              │
  ├─ [édition prompts optionnelle]│                             │
  ├─ POST /pipeline/faceless/gen ►│                             │
  │                              ├─ fal.ai: génération ────────►│
  │                              │   (une requête par scène)    │
  │                              │◄─ imageUrls[] ──────────────┤
  │                              │                              │
  │  (si script → voix)          ├─ ElevenLabs: TTS ───────────►│
  │                              │◄─ audioFile ────────────────┤
  │                              │                              │
  │                              ├─ FFmpeg: assemblage          │
  │                              │   → concat clips             │
  │                              │   → mix audio                │
  │                              │   → export MP4               │
  │                              │                              │
  │                              ├─ Supabase Storage: upload    │
  │                              ├─ updateVideo(status:done)    │
  │                              │                              │
  │◄─ { outputUrl } ─────────────┤                              │
```

### 4.2 Service Claude AI (storyboard)

```typescript
// services/claude.ts
const prompt = `
Tu es un expert en production vidéo.
Découpe ce script en ${SCENE_COUNT} scènes visuelles.
Pour chaque scène, génère :
- description_visuelle: ce qu'on voit (prompt en anglais pour fal.ai)
- texte_voix: le texte lu pendant cette scène
- duree_estimee: en secondes

Style visuel : ${style}
Script : ${script}

Réponds en JSON valide uniquement.
`
```

### 4.3 Styles → Prompts fal.ai

```typescript
const STYLE_CONFIGS = {
  'animation-2d': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: '2D cartoon animation style, vibrant colors, clean lines,',
    prompt_suffix: 'professional animation, studio quality',
  },
  'stock-vo': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'professional stock photo style, realistic,',
    prompt_suffix: 'high quality photography, editorial',
  },
  'minimaliste': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'minimalist design, clean white background, typography,',
    prompt_suffix: 'flat design, simple elegant',
  },
  'infographie': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'infographic style, data visualization, icons,',
    prompt_suffix: 'clean design, informative',
  },
  'whiteboard': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'whiteboard animation style, hand drawn, black marker on white,',
    prompt_suffix: 'educational illustration',
  },
  'cinematique': {
    model: 'fal-ai/flux/schnell',
    prompt_prefix: 'cinematic photography, dramatic lighting, film grain,',
    prompt_suffix: '4K quality, professional cinematography',
  },
}
```

---

## 5. Pipeline Motion Graphics

### 5.1 Flux

```
Brief + Brand Identity
         ↓
Claude AI → Storyboard avec timings
         ↓
fal.ai → Visuels de fond par scène
         ↓
Remotion → Overlay animations de marque
   (logo, couleurs, typographie, transitions)
         ↓
ElevenLabs → Voix off (optionnel)
         ↓
FFmpeg → Assemblage final MP4
```

### 5.2 Remotion — Composition de marque

```typescript
// remotion/BrandOverlay.tsx
export const BrandOverlay: React.FC<BrandProps> = ({
  logo, primaryColor, secondaryColor, fontFamily, scene
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <AbsoluteFill>
      {/* Fond visuel (image fal.ai) */}
      <Img src={scene.backgroundUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

      {/* Overlay couleur de marque */}
      <AbsoluteFill style={{ background: `${primaryColor}33` }} />

      {/* Texte animé */}
      <Sequence from={fps * 0.5}>
        <AnimatedText text={scene.title} font={fontFamily} color={secondaryColor} />
      </Sequence>

      {/* Logo */}
      <Img src={logo} style={{ position: 'absolute', bottom: 40, right: 40, height: 60 }} />
    </AbsoluteFill>
  )
}
```

---

## 6. Supabase — Détails techniques

### 6.1 Row Level Security (RLS)

```sql
-- profiles : lecture et écriture seulement sur son propre profil
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- videos : accès seulement à ses propres vidéos
CREATE POLICY "Users can manage own videos"
  ON videos FOR ALL
  USING (auth.uid() = user_id);

-- cloned_voices : accès seulement à ses propres voix
CREATE POLICY "Users can manage own voices"
  ON cloned_voices FOR ALL
  USING (auth.uid() = user_id);
```

### 6.2 Storage Buckets

```
videos/
├── {user_id}/
│   ├── {video_id}/
│   │   ├── output.mp4          # Vidéo finale
│   │   ├── scenes/
│   │   │   ├── scene_001.jpg   # Visuels générés
│   │   │   └── scene_002.jpg
│   │   └── audio/
│   │       └── voiceover.mp3

voice-samples/
├── {user_id}/
│   └── {voice_id}.mp3          # Échantillons pour clonage

brand-assets/
└── {user_id}/
    └── {project_id}/
        └── logo.png
```

---

## 7. Gestion des paiements

### 7.1 Stripe

```typescript
// services/stripe.ts
export async function createCheckoutSession(userId: string, plan: string) {
  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${FRONTEND_URL}/settings/billing?success=true`,
    cancel_url:  `${FRONTEND_URL}/settings/billing?canceled=true`,
    metadata: { userId, plan },
  })
  return session
}

// Webhook handler
export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await activateSubscription(event.data.object)
      break
    case 'customer.subscription.deleted':
      await cancelSubscription(event.data.object)
      break
  }
}
```

### 7.2 Moneroo

```typescript
// services/moneroo.ts
export async function createMonerooPayment(userId: string, plan: string, phone: string) {
  const response = await fetch('https://api.moneroo.io/v1/payments/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MONEROO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: PLAN_PRICES[plan],
      currency: 'XOF',
      description: `CLYRO — Plan ${plan}`,
      customer: { phone, metadata: { userId, plan } },
      return_url: `${FRONTEND_URL}/settings/billing?success=true`,
      notify_url: `${BACKEND_URL}/webhook/moneroo`,
    }),
  })
  return response.json()
}
```

---

## 8. Temps réel — Suivi de génération

Les vidéos peuvent prendre 1-3 minutes à générer. On utilise **SSE (Server-Sent Events)** pour le suivi en temps réel :

```typescript
// Backend — route SSE
app.get('/api/v1/videos/:id/status', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const sendUpdate = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Écouter les mises à jour Supabase Realtime
  const subscription = supabase
    .channel(`video-${req.params.id}`)
    .on('postgres_changes', { event: 'UPDATE', table: 'videos' }, (payload) => {
      sendUpdate({ status: payload.new.status, progress: payload.new.metadata?.progress })
      if (payload.new.status === 'done' || payload.new.status === 'error') {
        subscription.unsubscribe()
        res.end()
      }
    })
    .subscribe()
})
```

```typescript
// Frontend — hook useVideoStatus
export function useVideoStatus(videoId: string) {
  const [status, setStatus] = useState<VideoStatus>('pending')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/api/v1/videos/${videoId}/status`)
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setStatus(data.status)
      setProgress(data.progress ?? 0)
      if (data.status === 'done' || data.status === 'error') {
        eventSource.close()
      }
    }
    return () => eventSource.close()
  }, [videoId])

  return { status, progress }
}
```

---

## 9. Variables d'environnement — Récapitulatif complet

### Frontend (Vercel)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.clyro.app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Backend (Render)
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# IA
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
FAL_KEY=...

# Paiements
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MONEROO_API_KEY=...
MONEROO_WEBHOOK_SECRET=...

# Email
RESEND_API_KEY=re_...

# App
FRONTEND_URL=https://app.clyro.app
BACKEND_URL=https://api.clyro.app
NODE_ENV=production
PORT=4000
```

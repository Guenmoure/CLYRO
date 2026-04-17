# ARCHITECTURE.md — Architecture technique CLYRO

**Version :** 2.0
**Date :** Avril 2026

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
   │  clyro.ai   │                         │  app.clyro.ai   │
   └─────────────┘                         └────────┬────────┘
                                                    │ API calls (JWT)
                                           ┌────────▼────────┐
                                           │    RENDER       │
                                           │  Node.js API    │
                                           │  api.clyro.ai   │
                                           └──┬──┬──┬──┬────┘
                                              │  │  │  │
               ┌──────────────────────────────┘  │  │  └────────────┐
               │            ┌────────────────────┘  │               │
               │            │                        │               │
      ┌────────▼───┐  ┌─────▼──────┐  ┌─────────────▼──┐  ┌────────▼───┐
      │  SUPABASE  │  │  SERVICES  │  │ REMOTION LAMBDA│  │ PAIEMENTS  │
      │Auth+DB+    │  │IA: Claude  │  │   AWS Lambda   │  │Stripe +    │
      │Storage+    │  │fal.ai      │  │   + S3         │  │Moneroo     │
      │Realtime    │  │ElevenLabs  │  └────────────────┘  └────────────┘
      └────────────┘  │FFmpeg      │
                      │Puppeteer   │
                      └────────────┘
```

---

## 2. Frontend — Next.js (Vercel)

### 2.1 Middleware d'authentification

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect('/login')
  }
  return res
}
```

### 2.2 Supabase Realtime — statuts de génération

```typescript
// hook useProjectStatus.ts
supabase.channel('project-status')
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public',
    table: 'projects', filter: `id=eq.${projectId}`
  }, (payload) => {
    if (payload.new.status === 'done') showVideoPlayer(payload.new.output_url)
    if (payload.new.status === 'error') showErrorState(payload.new.metadata?.error)
  }).subscribe()
```

### 2.3 Communication Frontend → Backend

```typescript
// lib/api.ts
export async function startGeneration(feature: 'f1' | 'f2' | 'f3', payload: unknown) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/pipeline/${feature}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
```

---

## 3. Backend — Node.js (Render)

### 3.1 Routes complètes

```
# Pipelines
POST   /api/v1/pipeline/faceless              # Lance pipeline F1
POST   /api/v1/pipeline/faceless/scene        # Régénère une scène F1
POST   /api/v1/pipeline/motion                # Lance pipeline F2
POST   /api/v1/pipeline/motion/scene          # Régénère une scène F2
POST   /api/v1/pipeline/brand                 # Lance pipeline F3

# Projets
GET    /api/v1/projects                       # Liste projets utilisateur
GET    /api/v1/projects/:id                   # Détail + statut
DELETE /api/v1/projects/:id                   # Suppression

# Voix
POST   /api/v1/voices/clone                   # Clone une voix
GET    /api/v1/voices                         # Liste voix (publiques + perso)
DELETE /api/v1/voices/:id                     # Supprime voix clonée

# Paiements
POST   /api/v1/checkout/stripe                # Crée session Stripe Checkout
POST   /api/v1/checkout/moneroo               # Crée paiement Moneroo
POST   /webhook/stripe                        # Webhook Stripe (signature check)
POST   /webhook/moneroo                       # Webhook Moneroo (signature check)

# Health
GET    /api/v1/health                         # Health check
```

### 3.2 Middleware d'authentification

```typescript
// middleware/auth.ts
export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token', code: 'NO_TOKEN' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' })

  req.user = user
  next()
}
```

### 3.3 Middleware quota

```typescript
// middleware/quota.ts
const LIMITS = {
  starter:    { f1: 999, f2: 999, f3: 5 },
  pro:        { f1: 999, f2: 999, f3: 999 },
  entreprise: { f1: 999, f2: 999, f3: 999 },
}

export async function quotaMiddleware(feature: 'f1' | 'f2' | 'f3') {
  return async (req, res, next) => {
    const { data: sub } = await supabase.from('profiles')
      .select('plan,status').eq('id', req.user.id).single()

    if (sub.status !== 'active')
      return res.status(403).json({ error: 'Subscription inactive', code: 'SUBSCRIPTION_INACTIVE' })

    const { data: usage } = await supabase.from('usage')
      .select('count').eq('user_id', req.user.id)
      .eq('feature', feature).eq('period_start', startOfMonth()).single()

    if ((usage?.count ?? 0) >= LIMITS[sub.plan][feature])
      return res.status(403).json({ error: 'Quota exceeded', code: 'QUOTA_EXCEEDED', plan: sub.plan })

    next()
  }
}
```

### 3.4 Auth inter-services (HMAC)

```typescript
// middleware/hmac.ts — sécuriser les appels Next.js → Render
export function hmacMiddleware(req, res, next) {
  const sig = req.headers['x-signature']
  const expected = crypto.createHmac('sha256', process.env.RENDER_SERVICE_SECRET)
    .update(JSON.stringify(req.body)).digest('hex')
  if (sig !== expected) return res.status(401).json({ error: 'Unauthorized' })
  next()
}
```

---

## 4. Pipeline F1 — Faceless Videos

### 4.1 Connexions service par service

```
Utilisateur → POST /api/v1/pipeline/faceless
                ↓
          Next.js API Route
                ↓ INSERT
          Supabase (projects + scenes)
                ↓ streaming JSON
          Claude API (Scene Director)
          → tableau de scènes avec prompts image + animation
                ↓ Promise.all()
          ┌─────────────────────────────────┐
          │                                 │
     fal.ai (images)              ElevenLabs (/with-timestamps)
     flux/schnell (preview 3s)    → audio MP3 + word timestamps
     flux-pro (HD 15s)            → recalcul duration_frames si dépassement
          │                                 │
          └──────────── Supabase Storage ───┘
                ↓ (images HD validées)
          fal.ai kling-v1.5 (image-to-video)
          → clip MP4 par scène (duration = audio_duration + 0.5s)
                ↓
          Remotion Lambda (renderMediaOnLambda)
          inputProps: { scenes[], fps, format }
          composition: 'FacelessVideo'
          → MP4 silencieux sur S3
                ↓
          POST /mix-audio (Render FFmpeg service)
          → voix off + musique de fond (ducking)
          → MP4 final → Supabase Storage
                ↓
          Supabase Realtime → Browser (status: 'done')
          Resend email si tab_active = false
```

### 4.2 Service Claude — Scene Director

```typescript
// services/claude.ts — prompt system F1
const SCENE_DIRECTOR_PROMPT = `
Tu es un expert en production vidéo faceless.
Découpe ce script en scènes visuelles.
Pour chaque scène, génère UNIQUEMENT ce JSON :
{
  "scenes": [
    {
      "scene_index": 0,
      "summary": "...",
      "text": "texte dit pendant la scène",
      "duration_estimate": 8,
      "image_prompt": "prompt en anglais pour fal.ai, style ${style}, personnages cohérents",
      "animation_prompt": "slow zoom in, camera movement description"
    }
  ]
}

Style visuel : ${style}
Cohérence : maintenir les mêmes personnages et couleurs entre toutes les scènes.
Ne jamais inclure de texte dans les image_prompts (idéogram n'est pas utilisé ici).
`
```

### 4.3 Styles → Modèles fal.ai

```typescript
const STYLE_CONFIGS = {
  'animation-2d': {
    model: 'fal-ai/flux-pro',
    prompt_prefix: '2D cartoon animation style, vibrant colors, clean lines,',
    prompt_suffix: 'professional animation, studio quality',
  },
  'stock-vo': {
    model: 'fal-ai/flux-pro-v1.1-ultra',
    prompt_prefix: 'professional stock photo style, realistic,',
    prompt_suffix: 'high quality photography, editorial',
  },
  'minimaliste': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'minimalist design, clean background, flat shapes,',
    prompt_suffix: 'flat design, simple elegant',
  },
  'infographie': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'infographic illustration style, icons, data viz,',
    prompt_suffix: 'clean design, informative, colorful',
  },
  'whiteboard': {
    model: 'fal-ai/flux/dev',
    prompt_prefix: 'whiteboard animation style, hand drawn, black marker on white,',
    prompt_suffix: 'educational illustration, sketch style',
  },
  'cinematique': {
    model: 'fal-ai/flux-pro-v1.1-ultra',
    prompt_prefix: 'cinematic photography, dramatic lighting, film grain,',
    prompt_suffix: '4K quality, professional cinematography, anamorphic',
  },
}
```

### 4.4 Cohérence visuelle entre scènes

```typescript
// Après validation de la 1ère image, extraire le style anchor
const styleAnchor = await extractStyleTokens(scene0.image_url)
// Injecter dans tous les prompts suivants :
const enrichedPrompt = `${scene.image_prompt}
Style reference: ${styleAnchor.description}
Character consistency: ${styleAnchor.character_description}
Color palette: ${styleAnchor.dominant_colors.join(', ')}`
```

### 4.5 Composition Remotion — FacelessVideo

```typescript
// remotion/FacelessVideo.tsx
export const FacelessVideo: React.FC<FacelessProps> = ({ scenes, fps, format }) => {
  let fromFrame = 0
  return scenes.map((scene, i) => {
    const el = (
      <Sequence key={i} from={fromFrame} durationInFrames={scene.duration_frames}>
        <Video src={scene.clip_url} />
        <KaraokeCaption
          timestamps={scene.timestamps_json}
          fps={fps}
          style={captionStyle}
        />
        <Audio src={scene.audio_url} />
      </Sequence>
    )
    fromFrame += scene.duration_frames
    return el
  })
}
```

### 4.6 FFmpeg — mix audio final

```bash
ffmpeg -i video_silent.mp4 \
  -i voice_combined.mp3 \
  -i music_bg.mp3 \
  -filter_complex "[2:a]volume=0.25[music];[1:a][music]amix=inputs=2:duration=first[aout]" \
  -map 0:v -map "[aout]" \
  -c:v copy -c:a aac -b:a 192k \
  output_final.mp4
```

---

## 5. Pipeline F2 — Motion Design

### 5.1 Différences clés vs F1

- Pas de Kling image-to-video — Remotion anime directement en React/CSS
- Claude génère un JSON storyboard **typé** avec des composants Remotion nommés
- Le recalcul de timing audio est critique (durée fixe dans le JSON storyboard)
- FFmpeg génère aussi un thumbnail JPEG (frame à t=3s) pour les ads

### 5.2 Types de scènes Remotion valides

```typescript
// LISTE EXHAUSTIVE — Claude ne peut pas inventer d'autres types
type SceneType = 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'
type AnimationType = 'slide_up' | 'fade_in' | 'scale_pop' | 'parallax_reveal' | 'typewriter' | 'blur_reveal'
```

### 5.3 JSON storyboard — structure

```typescript
interface Storyboard {
  fps: 30
  total_frames: number     // recalculé après ElevenLabs
  scenes: [{
    id: string
    type: SceneType
    duration_frames: number
    text: { headline?: string; sub?: string; body?: string; cta?: string }
    animation: AnimationType
    colors: { bg: string; text: string; accent: string }
    fal_prompt?: string    // uniquement si image nécessaire
    fal_model?: string     // clé du MODEL_MAP
    image_url?: string     // rempli après génération fal.ai
  }]
}
```

### 5.4 Matrice modèles fal.ai — F2

```typescript
const MODEL_MAP: Record<string, string> = {
  'product_studio':    'fal-ai/flux-pro-v1.1-ultra',
  'lifestyle':         'fal-ai/flux-pro',
  'illustration':      'fal-ai/recraft-v3',
  'texture_abstract':  'fal-ai/flux/dev',
  'text_in_image':     'fal-ai/ideogram-v2',
  'preview_draft':     'fal-ai/flux/schnell',   // preview avant HD
}
```

### 5.5 Recalcul timing ElevenLabs → Remotion

```typescript
for (const scene of storyboard.scenes) {
  if (!scene.text?.body && !scene.text?.headline) continue
  const audioMs = await generateVoice(scene)
  const voiceFrames = Math.ceil((audioMs / 1000) * fps * 1.1) // +10% buffer
  if (voiceFrames > scene.duration_frames) {
    scene.duration_frames = voiceFrames
    storyboard.total_frames = storyboard.scenes.reduce((a, s) => a + s.duration_frames, 0)
    await supabase.from('projects').update({ metadata: { storyboard } }).eq('id', projectId)
  }
}
```

### 5.6 DynamicComposition Remotion — F2

```typescript
// remotion/MotionVideo.tsx
export const MotionVideo: React.FC<{ storyboard: Storyboard }> = ({ storyboard }) => {
  let fromFrame = 0
  return storyboard.scenes.map((scene, i) => {
    const el = (
      <Sequence key={i} from={fromFrame} durationInFrames={scene.duration_frames}>
        {scene.type === 'text_hero'         && <TextHero {...scene} />}
        {scene.type === 'split_text_image'  && <SplitTextImage {...scene} />}
        {scene.type === 'product_showcase'  && <ProductShowcase {...scene} />}
        {scene.type === 'stats_counter'     && <StatsCounter {...scene} />}
        {scene.type === 'cta_end'           && <CtaEnd {...scene} />}
        {scene.type === 'image_full'        && <ImageFull {...scene} />}
      </Sequence>
    )
    fromFrame += scene.duration_frames
    return el
  })
}
```

---

## 6. Pipeline F3 — Brand Kit

### 6.1 Flux complet

```
Brief utilisateur
    ↓ Claude (Brand Analyst — passe 1)
    → validation, contradictions, WCAG check
    ↓ Claude (Creative Director — passe 2)
    → 3 directions JSON (palette, typo, mood, logo_prompt)
    ↓ fal.ai recraft-v3 × 3 en parallèle
    → logos previews
    ↓ Sélection direction utilisateur
    ↓ fal.ai × 8-12 assets en batches de 4
    → variantes logo (rembg) + mockups (flux-pro-ultra) + patterns (flux/dev)
    ↓ Claude (Brand Charter Writer)
    → charte Markdown 15-25 pages avec URLs assets
    ↓ POST /generate-pdf (Render Puppeteer)
    → PDF A4 streamé → Supabase Storage
    ↓ ZIP archiver streaming → Supabase Storage
    ↓ Resend email avec lien téléchargement
```

### 6.2 Matrice modèles fal.ai — F3

```typescript
const BRAND_MODEL_MAP: Record<string, string> = {
  'logo':              'fal-ai/recraft-v3',           // vector_illustration
  'logo_rembg':        'fal-ai/imageutils/rembg',     // fond transparent
  'mockup_studio':     'fal-ai/flux-pro-v1.1-ultra',  // carte de visite, packaging
  'mockup_lifestyle':  'fal-ai/flux-pro',             // contexte réel
  'illustration':      'fal-ai/recraft-v3',
  'pattern':           'fal-ai/flux/dev',
  'wordmark':          'fal-ai/ideogram-v2',          // logo avec texte lisible
  'preview':           'fal-ai/flux/schnell',         // preview rapide
}
```

### 6.3 Règle absolue — jamais de texte dans les logos générés

```typescript
// Le nom de marque N'EST JAMAIS dans le prompt fal.ai
// Il est superposé en CSS/SVG avec la vraie typographie Google Fonts
const logoPrompt = direction.logo_prompt  // ne contient jamais le nom
// Dans l'UI :
<div style={{ fontFamily: direction.typography.heading }}>
  {brandName}  {/* nom ajouté en overlay */}
</div>
```

### 6.4 Style anchor — cohérence entre assets

```typescript
// Après sélection de la direction, injecter dans chaque prompt
const styleAnchor = `
Cohérence de marque: couleur primaire ${direction.palette.primary},
couleur secondaire ${direction.palette.secondary},
ambiance: ${direction.mood.join(', ')}.
Référence logo validé: ${logoUrl}
`
```

### 6.5 PDF Puppeteer — streaming vers Supabase

```typescript
// services/puppeteer.ts sur Render
const page = await browser.newPage()
await page.setContent(markdownToHtml(markdown, brandedCss), { waitUntil: 'networkidle0' })
const pdfStream = await page.createPDFStream({
  format: 'A4', printBackground: true,
  margin: { top: '40px', bottom: '40px', left: '50px', right: '50px' }
})
// Stream direct vers Supabase (pas en mémoire)
await fetch(supabaseSignedUploadUrl, { method: 'PUT', body: pdfStream })
```

### 6.6 ZIP brand kit — structure

```
brand-kit/
├── logos/
│   ├── logo-white-bg-1x.png / 2x.png / 3x.png
│   ├── logo-dark-bg-1x.png / 2x.png / 3x.png
│   └── logo-transparent-1x.png / 2x.png / 3x.png
├── palette/
│   ├── palette.json    # { primary, secondary, accent, bg, text } HEX+RGB
│   └── palette.ase     # Adobe Swatch Exchange
├── mockups/            # tous les assets fal.ai
├── charter.pdf
└── README.md
```

---

## 7. Remotion — Connexion au système

### 7.1 Déploiement Lambda (une seule fois + à chaque changement)

```bash
# Déployer la fonction Lambda
npx remotion lambda functions deploy

# Déployer les compositions React sur S3
npx remotion lambda sites create --site-name=clyro-video
# → retourne REMOTION_SERVE_URL à stocker dans les env vars
```

### 7.2 Déclencher un rendu depuis l'API Node.js

```typescript
import { renderMediaOnLambda, getRenderProgress } from '@remotion/lambda/client'

// Lancer le rendu
const { renderId, bucketName } = await renderMediaOnLambda({
  region: process.env.AWS_REGION,
  functionName: process.env.REMOTION_FUNCTION_NAME,
  serveUrl: process.env.REMOTION_SERVE_URL,
  composition: 'FacelessVideo',          // ou 'MotionVideo'
  inputProps: { scenes, fps: 30, format: '9:16' },
  codec: 'h264',
  outName: `${projectId}-silent.mp4`,
})

// Stocker renderId dans Supabase pour tracking
await supabase.from('projects').update({ metadata: { renderId, bucketName } }).eq('id', projectId)
```

### 7.3 Polling du statut

```typescript
const progress = await getRenderProgress({
  renderId, bucketName,
  functionName: process.env.REMOTION_FUNCTION_NAME,
  region: process.env.AWS_REGION,
})

if (progress.done) {
  const silentMp4Url = progress.outputFile  // URL S3
  // → envoyer à FFmpeg pour le mix audio
}
```

### 7.4 Warm-up Lambda (éviter cold start)

```typescript
// Cron job Vercel toutes les 4 minutes
// app/api/cron/warmup-lambda/route.ts
export async function GET() {
  await renderMediaOnLambda({
    composition: 'TestComposition',
    inputProps: { warmup: true },
    framesPerLambda: 1,
    // ...
  })
  return Response.json({ warmed: true })
}
```

---

## 8. Supabase — Détails techniques

### 8.1 Row Level Security (RLS)

```sql
-- profiles
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- projects
CREATE POLICY "Users manage own projects"
  ON projects FOR ALL USING (auth.uid() = user_id);

-- scenes
CREATE POLICY "Users access own scenes"
  ON scenes FOR ALL
  USING (auth.uid() = (SELECT user_id FROM projects WHERE id = project_id));

-- brand_projects
CREATE POLICY "Users manage own brand projects"
  ON brand_projects FOR ALL USING (auth.uid() = user_id);

-- usage
CREATE POLICY "Users read own usage"
  ON usage FOR SELECT USING (auth.uid() = user_id);

-- cloned_voices
CREATE POLICY "Users manage own voices"
  ON cloned_voices FOR ALL USING (auth.uid() = user_id);
```

### 8.2 Storage Buckets

```
videos/              # PUBLIC (URLs signées pour téléchargement)
├── {user_id}/
│   └── {project_id}/
│       ├── scenes/
│       │   ├── {scene_id}/image.png
│       │   ├── {scene_id}/voice.mp3
│       │   └── {scene_id}/clip.mp4
│       ├── silent.mp4
│       └── output.mp4

brands/              # PUBLIC
├── {user_id}/
│   └── {project_id}/
│       ├── logos/
│       ├── mockups/
│       ├── charter.pdf
│       └── brand-kit.zip

voice-samples/       # PRIVATE
└── {user_id}/
    └── {voice_id}.mp3
```

### 8.3 Vues SQL utiles

```sql
-- MRR par plan
CREATE VIEW mrr_by_plan AS
SELECT
  plan,
  COUNT(*) AS active_users,
  COUNT(*) * CASE plan
    WHEN 'pro' THEN 19
    WHEN 'entreprise' THEN 79
    ELSE 0 END AS mrr
FROM profiles
WHERE status = 'active'
GROUP BY plan;
```

---

## 9. Gestion des paiements

### 9.1 Stripe

```typescript
// services/stripe.ts
export async function createCheckoutSession(userId: string, plan: string) {
  const PRICE_IDS = {
    pro:        process.env.STRIPE_PRICE_PRO,
    entreprise: process.env.STRIPE_PRICE_ENTREPRISE,
  }
  const session = await stripe.checkout.sessions.create({
    customer: await getOrCreateStripeCustomer(userId),
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
    cancel_url:  `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
    metadata: { userId, plan },
  })
  return session
}
```

### 9.2 Webhooks Stripe — 5 événements obligatoires

```typescript
switch (event.type) {
  case 'checkout.session.completed':
    // → CREATE ou UPDATE subscription dans Supabase
    break
  case 'customer.subscription.updated':
    // → UPDATE plan + status + current_period_end
    break
  case 'customer.subscription.deleted':
    // → status = 'canceled', plan = 'starter'
    break
  case 'invoice.payment_failed':
    // → status = 'past_due' + email Resend d'alerte
    break
  case 'invoice.payment_succeeded':
    // → status = 'active', reset usage mensuel
    break
}
```

### 9.3 Moneroo (Mobile Money Afrique)

```typescript
// services/moneroo.ts
export async function createMonerooPayment(userId: string, plan: string, phone: string) {
  const PLAN_PRICES = { pro: 12500, entreprise: 51800 }  // XOF
  const response = await fetch('https://api.moneroo.io/v1/payments/initialize', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.MONEROO_API_KEY}` },
    body: JSON.stringify({
      amount: PLAN_PRICES[plan],
      currency: 'XOF',
      description: `CLYRO — Plan ${plan}`,
      customer: { phone, metadata: { userId, plan } },
      return_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      notify_url: `${process.env.BACKEND_URL}/webhook/moneroo`,
    }),
  })
  return response.json()
}
```

---

## 10. Analytics — Posthog

### 10.1 Setup

```typescript
// Frontend — Next.js
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: 'https://eu.posthog.com',
  person_profiles: 'identified_only',  // RGPD
  capture_pageview: false,
})
posthog.identify(user.id, { email: user.email, plan: subscription.plan })
```

### 10.2 Events critiques à tracker

```typescript
// Events envoyés côté serveur (posthog-node) pour fiabilité maximale
posthog.capture({ distinctId: userId, event: 'video_downloaded', properties: { feature, format, plan } })
posthog.capture({ distinctId: userId, event: 'render_failed', properties: { error_type, step } })
posthog.capture({ distinctId: userId, event: 'quota_hit', properties: { feature, plan } })
posthog.capture({ distinctId: userId, event: 'subscription_started', properties: { plan, mrr } })
```

### 10.3 Métriques North Star

| Métrique | Cible | Alerte si |
|----------|-------|-----------|
| Activation rate (première vidéo < 24h) | ≥ 70% | < 50% |
| D7 retention | ≥ 40% | < 25% |
| Conversion free → pro | ≥ 8% | < 5% |
| Time-to-first-video | ≤ 4 min | > 8 min |
| render_failed rate | < 5% | > 5% sur 1h |
| image_regenerated rate | < 30% | > 40% sur 24h → réviser prompts Claude |

---

## 11. Coûts de revient par génération

| Opération | Coût estimé |
|-----------|-------------|
| Images fal.ai flux-pro × 6 scènes | ~0.18€ |
| Image-to-video Kling × 6 scènes | ~0.30€ |
| Voix ElevenLabs (~3000 chars) | ~0.06€ |
| Claude orchestration | ~0.02€ |
| Remotion Lambda + S3 | ~0.03€ |
| **Total vidéo F1 complète** | **~0.59€** |
| Brand kit F3 complet | ~0.35€ |

**Seuil Pro (19€/mois) :** rentable jusqu'à ~32 vidéos F1/mois par utilisateur.

---

## 12. Variables d'environnement — Référence complète

### Vercel (Next.js)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.clyro.ai
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_APP_URL=https://clyro.ai
```

### Render (Node.js + FFmpeg + Puppeteer)
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# IA
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=sk_...
FAL_KEY=...
FAL_KEY_ID=...
FAL_KEY_SECRET=...

# AWS / Remotion
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-west-1
REMOTION_FUNCTION_NAME=remotion-render-4-0-0-mem2048mb-disk2048mb-240sec
REMOTION_SERVE_URL=https://s3.eu-west-1.amazonaws.com/...

# Paiements
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MONEROO_API_KEY=...
MONEROO_WEBHOOK_SECRET=...

# Email
RESEND_API_KEY=re_...

# Auth inter-services
RENDER_SERVICE_SECRET=...    # HMAC partagé avec Next.js

# App
FRONTEND_URL=https://clyro.ai
BACKEND_URL=https://api.clyro.ai
NODE_ENV=production
PORT=4000
```

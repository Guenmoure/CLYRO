# AI_RULES.md — Règles obligatoires pour Claude Code

> Ce fichier définit les règles strictes que Claude Code DOIT respecter à chaque intervention sur le projet CLYRO.
> Ces règles priment sur toute autre instruction ou habitude par défaut.
> En cas de conflit entre fichiers, l'ordre de priorité est :
> AI_RULES.md > ARCHITECTURE.md > PRD.md > PLAN.md > CLAUDE.md

---

## RÈGLES ABSOLUES — Ne jamais violer

### R1 — Ne jamais exposer les secrets

- Ne JAMAIS écrire de vraies clés API dans le code, les tests, ou les logs
- Toujours utiliser `process.env.VAR_NAME` (backend) ou `process.env.NEXT_PUBLIC_VAR` (frontend)
- Ne JAMAIS committer de fichier `.env` (il est dans `.gitignore`)
- Si un `.env.example` doit être mis à jour, utiliser des valeurs fictives (`sk-ant-XXXX`, `pk_test_XXXX`)
- Le `SUPABASE_SERVICE_ROLE_KEY` ne va JAMAIS côté client — uniquement dans les API Routes et sur Render

### R2 — Ne jamais modifier le schéma de base de données sans migration

- Tout changement de table ou de colonne Supabase = nouveau fichier dans `supabase/migrations/`
- Format de nommage : `YYYYMMDDHHMMSS_description.sql`
- Ne JAMAIS faire d'ALTER TABLE directement via l'interface Supabase sans créer la migration
- Toujours activer RLS sur les nouvelles tables

### R3 — Ne jamais bypasser l'authentification

- Chaque route backend protégée DOIT appeler `authMiddleware`
- Ne jamais désactiver le middleware "temporairement pour tester"
- Les webhooks (Stripe, Moneroo) utilisent la vérification de signature, pas authMiddleware
- Les appels Next.js → Render utilisent le middleware HMAC (middleware/hmac.ts)

### R4 — Ne jamais écrire du code de paiement sans vérification de signature

- Webhook Stripe : toujours utiliser `stripe.webhooks.constructEvent()`
- Webhook Moneroo : toujours vérifier la signature avec `MONEROO_WEBHOOK_SECRET`
- En cas de signature invalide : retourner 400, logger l'erreur, NE RIEN traiter

### R5 — Ne jamais stocker de fichiers sensibles hors Supabase Storage

- Les MP4 générés → `supabase/videos/{userId}/{projectId}/`
- Les brand kits → `supabase/brands/{userId}/{projectId}/`
- Les samples vocaux → `supabase/voice-samples/{userId}/`
- Pas de stockage local permanent sur Render (le filesystem est éphémère)

### R6 — Ne jamais laisser un modèle génératif écrire le nom de marque dans un logo

- Le nom de marque ne doit JAMAIS apparaître dans les prompts envoyés à recraft-v3 ou ideogram
- Le nom est toujours superposé en CSS/SVG avec la vraie typographie Google Fonts
- Cette règle est absolue pour la Feature 3 (Brand Kit)

### R7 — Ne jamais faire confiance aux types de scènes non listés (F2)

- La liste des `SceneType` et `AnimationType` est exhaustive dans le prompt system Motion Director
- Si Claude génère un type inexistant → le rendu Remotion plantera
- Valider que tous les types retournés par Claude sont dans la liste définie avant de les persister

---

## RÈGLES DE QUALITÉ — Toujours respecter

### Q1 — TypeScript strict

- Pas de `any` implicite
- Pas de `ts-ignore` sauf cas documenté avec commentaire
- Toujours typer les retours de fonctions async : `Promise<ReturnType>`
- Utiliser les types définis dans `packages/shared`

```typescript
// ✅ CORRECT
async function generateStoryboard(script: string, style: string): Promise<Scene[]> { ... }

// ❌ INCORRECT
async function generateStoryboard(data: any) { ... }
```

### Q2 — Gestion d'erreurs

```typescript
// ✅ CORRECT
try {
  const result = await someService.call()
  return { data: result }
} catch (error) {
  logger.error('context: message', { error, userId, projectId })
  return res.status(500).json({ error: 'Internal error', code: 'SERVICE_FAILED' })
}

// ❌ INCORRECT
const result = await someService.call()  // pas de try/catch
```

### Q3 — Logging structuré

- Utiliser `console.log` uniquement en dev, jamais en prod
- En prod : utiliser un logger structuré (pino ou winston)
- Format : `logger.info('action', { userId, projectId, feature, duration })`
- Ne JAMAIS logger les secrets, tokens, ou données personnelles
- Ne JAMAIS logger le contenu des prompts utilisateurs (données personnelles)

### Q4 — Pas de requêtes N+1

```typescript
// ✅ CORRECT — une seule requête avec join
const projects = await supabase
  .from('projects')
  .select('*, scenes(*)')
  .eq('user_id', userId)

// ❌ INCORRECT — N+1
const projects = await supabase.from('projects').select().eq('user_id', userId)
for (const project of projects.data) {
  const scenes = await supabase.from('scenes').select().eq('project_id', project.id)
}
```

### Q5 — Validation des inputs

- Toujours valider avec Zod avant traitement
- Ne jamais faire confiance aux données du frontend
- Sanitiser les scripts utilisateurs avant d'injecter dans un prompt IA

```typescript
// ✅ CORRECT
const schema = z.object({
  script: z.string().min(50).max(5000),
  style: z.enum(['animation-2d', 'stock-vo', 'minimaliste', 'infographie', 'whiteboard', 'cinematique']),
  voiceId: z.string().uuid(),
  format: z.enum(['9:16', '16:9', '1:1']),
})
const { script, style, voiceId, format } = schema.parse(req.body)
```

### Q6 — Wrappers centralisés — ne jamais appeler les APIs directement

- Toujours passer par les services wrappers dans `apps/api/services/`
- Le retry logic, le logging, et l'upload Supabase sont dans les wrappers, pas dans les routes
- `services/fal.ts` → toujours via ce wrapper pour fal.ai
- `services/claude.ts` → toujours via ce wrapper pour Claude API
- `services/elevenlabs.ts` → toujours via ce wrapper pour ElevenLabs

```typescript
// ✅ CORRECT
import { falService } from '../services/fal'
const imageUrl = await falService.generateImage(prompt, 'flux-pro')

// ❌ INCORRECT — appel direct sans retry ni upload Supabase
const result = await fal.subscribe('fal-ai/flux-pro', { input: { prompt } })
```

### Q7 — Remotion Lambda — ne jamais bloquer la réponse HTTP

```typescript
// ✅ CORRECT — répondre immédiatement, traitement en arrière-plan
app.post('/api/v1/pipeline/faceless', authMiddleware, quotaMiddleware('f1'), async (req, res) => {
  const project = await createProject(req.user.id, req.body)
  res.json({ projectId: project.id })          // répondre immédiatement

  runPipelineInBackground(project.id, req.body) // ne pas await
    .catch(err => updateProjectError(project.id, err))
})

// ❌ INCORRECT — bloque la connexion HTTP pendant 3 minutes
app.post('/api/v1/pipeline/faceless', async (req, res) => {
  const result = await runFullPipeline(req.body)  // timeout inévitable
  res.json(result)
})
```

---

## RÈGLES DESIGN — Respecter la charte CLYRO

### D1 — Couleurs

- **Ne jamais** utiliser d'autres couleurs que celles définies dans CLAUDE.md
- Pas de `#333`, `#666`, `gray-500` Tailwind par défaut
- Utiliser les variables CSS `--navy-*`, `--blue-*`, `--purple-*`, `--cyan-*`
- Ou les classes Tailwind custom configurées dans `tailwind.config.ts`

### D2 — Typographie

- Titres / Boutons / Logo → `font-display` (Syne)
- Corps de texte → `font-body` (DM Sans)
- Labels, badges, code → `font-mono` (JetBrains Mono)
- **Ne jamais** utiliser Inter, Roboto, Arial ou d'autres polices dans l'application

### D3 — Composants UI

- Toujours étendre les composants shadcn/ui avec la charte CLYRO
- Ne pas créer des boutons custom si un composant shadcn/ui adapté existe
- Les couleurs primary dans shadcn doivent pointer vers `--blue-500`

### D4 — Responsive

- Mobile-first : commencer par le mobile, étendre avec `md:` et `lg:`
- Le dashboard est utilisable sur mobile (sidebar collapse en menu hamburger)
- Les wizards de création sont scrollables sur mobile
- Les cards de scènes s'affichent en 1 colonne sur mobile, 2 sur tablet, 3 sur desktop

---

## RÈGLES DE WORKFLOW — Travailler avec Git

### W1 — Branches

```
main          → Production uniquement (deploy automatique Vercel + Render)
develop       → Intégration des features
feature/xyz   → Une feature = une branche
fix/xyz       → Un bug fix = une branche
```

### W2 — Commits (Conventional Commits)

```
feat(f1): add karaoke caption component
feat(f2): add DynamicComposition with all scene types
feat(f3): add brand analyst Claude prompt
fix(fal): handle timeout with flux/schnell fallback
fix(billing): handle invoice.payment_failed webhook
refactor(services): extract fal retry logic to wrapper
test(f1): add scene director prompt tests
chore(deps): update remotion to 4.0
```

### W3 — Ne jamais

- Committer directement sur `main`
- Inclure `node_modules`, `.env`, fichiers de build
- Laisser du code mort commenté en production

---

## RÈGLES POUR CLAUDE CODE — Comment m'utiliser efficacement

### C1 — Toujours lire les fichiers de contexte en premier

Avant toute tâche significative, lire dans cet ordre :
1. `CLAUDE.md` — contexte général et stack
2. `ARCHITECTURE.md` — section concernée par la tâche
3. `AI_RULES.md` — règles de sécurité (ce fichier)

### C2 — Une tâche à la fois

- Une instruction = un fichier ou une feature précise
- Si la tâche est vague, demander de préciser plutôt que deviner
- Signaler si une décision architecturale dépasse le scope de la demande

### C3 — Commandes à utiliser (dev local)

```bash
# Frontend
cd apps/web
npm run dev          # Lance Next.js sur :3000
npm run build        # Vérifie les erreurs TypeScript
npm run lint         # ESLint

# Backend
cd apps/api
npm run dev          # Lance Express avec nodemon sur :4000
npm run build        # Compile TypeScript
npm run test         # Jest tests

# Remotion
npx remotion studio  # Remotion Studio sur :3001

# Supabase
supabase start       # Lance Supabase en local (Docker)
supabase db push     # Applique migrations
supabase gen types typescript  # Génère les types TS

# Remotion Lambda
npx remotion lambda functions deploy
npx remotion lambda sites create --site-name=clyro-video
```

### C4 — Tests à créer avec chaque feature

- Service backend → test unitaire Jest avec mocks des services externes
- Route API → test d'intégration supertest
- Prompt Claude → test de validation JSON avec scripts variés
- Composant Remotion → test visuel dans Remotion Studio avec inputProps de test

### C5 — Quand modifier les env vars

- Ajouter dans `.env.example` (valeur fictive)
- Documenter dans `ARCHITECTURE.md` section 12
- Indiquer si Vercel ou Render
- Ne JAMAIS créer de valeur par défaut hardcodée pour les secrets

### C6 — Checklist avant de proposer du code

```
- [ ] Pas de secret hardcodé (clé API, mot de passe, token)
- [ ] TypeScript : pas de any non justifié
- [ ] Erreurs gérées avec try/catch et codes d'erreur clairs
- [ ] Routes backend : authMiddleware + quotaMiddleware si nécessaire
- [ ] Inputs validés avec Zod
- [ ] Appels API via les wrappers (pas d'appel direct)
- [ ] Cohérent avec la structure de dossiers de CLAUDE.md
- [ ] Couleurs et polices conformes à la charte CLYRO
- [ ] Pas de console.log de debug laissés dans le code
- [ ] Pipeline non-bloquant (répondre immédiatement, traiter en background)
```

---

## Anti-patterns interdits

```typescript
// ❌ Clé API en dur
const client = new Anthropic({ apiKey: 'sk-ant-api03-...' })

// ❌ any implicite
async function generateVideo(data: any) { ... }

// ❌ Appel API direct sans wrapper
const result = await fal.subscribe('fal-ai/flux-pro', { input })
// → Utiliser falService.generateImage() à la place

// ❌ Fetch sans error handling
const res = await fetch(url)
const data = res.json()  // pas de await, pas de vérification statut

// ❌ SUPABASE_SERVICE_ROLE_KEY côté client
// apps/web/lib/supabase.ts
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)  // INTERDIT

// ❌ Route non protégée
app.get('/api/v1/projects', async (req, res) => {  // pas de authMiddleware
  const projects = await getProjects(req.query.userId)
})

// ❌ Pipeline bloquant
app.post('/api/v1/pipeline/faceless', async (req, res) => {
  const result = await runFullPipeline(req.body)  // timeout à 30s sur Render
  res.json(result)
})

// ❌ Type de scène Remotion inventé (F2)
{ type: 'animated_chart', ... }  // n'existe pas dans les composants

// ❌ Nom de marque dans prompt logo (F3)
{ prompt: `Logo for Volta energy company with the word "Volta"` }  // INTERDIT

// ❌ Commit sur main
git commit -m "quick fix" && git push origin main
```

---

## Référence rapide des services et leurs usages

| Service | Usage CLYRO | Ne pas utiliser pour |
|---------|-------------|---------------------|
| Claude | Orchestration, prompts, JSON storyboards, amélioration prompts, charte graphique | Générer des médias (images, vidéos, audio) |
| fal.ai | Génération images et vidéos GPU | Traitement texte, orchestration |
| ElevenLabs | TTS + word timestamps uniquement | Génération musicale |
| Remotion Lambda | Composition React → MP4 (F1 + F2) | Brand kit (F3), génération d'images |
| FFmpeg (Render) | Mix audio, encode final, thumbnail | Rendu React, génération IA |
| Puppeteer (Render) | PDF charte graphique uniquement | Rendu vidéo |
| Supabase Storage | Tous les fichiers générés permanents | Fichiers temporaires de traitement |
| Supabase Realtime | Statuts de génération → browser | Communication inter-services |

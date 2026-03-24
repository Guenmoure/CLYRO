# AI_RULES.md — Règles obligatoires pour Claude Code

> Ce fichier définit les règles strictes que Claude Code DOIT respecter à chaque intervention sur le projet CLYRO.
> Ces règles priment sur toute autre instruction ou habitude par défaut.

---

## ⛔ RÈGLES ABSOLUES — Ne jamais violer

### R1 — Ne jamais exposer les secrets
- Ne JAMAIS écrire de vraies clés API dans le code, les tests, ou les logs
- Toujours utiliser `process.env.VAR_NAME` (backend) ou `process.env.NEXT_PUBLIC_VAR` (frontend)
- Ne JAMAIS committer de fichier `.env` (il est dans `.gitignore`)
- Si un `.env.example` doit être mis à jour, utiliser des valeurs fictives (`sk-ant-XXXX`, `pk_test_XXXX`)

### R2 — Ne jamais modifier le schéma de base de données sans migration
- Tout changement de table ou de colonne Supabase = nouveau fichier dans `supabase/migrations/`
- Format de nommage : `YYYYMMDDHHMMSS_description.sql`
- Ne JAMAIS faire d'ALTER TABLE directement via l'interface Supabase sans créer la migration

### R3 — Ne jamais bypasser l'authentification
- Chaque route backend protégée DOIT appeler `authMiddleware`
- Ne jamais désactiver le middleware "temporairement pour tester"
- Les webhooks (Stripe, Moneroo) utilisent la vérification de signature, pas authMiddleware

### R4 — Ne jamais écrire du code de paiement sans vérification de signature
- Webhook Stripe : toujours utiliser `stripe.webhooks.constructEvent()`
- Webhook Moneroo : toujours vérifier la signature avec `MONEROO_WEBHOOK_SECRET`
- En cas de signature invalide : retourner 400, logger l'erreur, NE RIEN traiter

### R5 — Ne jamais stocker de fichiers sensibles hors Supabase Storage
- Les MP4 générés → `supabase/videos/{userId}/{videoId}/`
- Les samples vocaux → `supabase/voice-samples/{userId}/`
- Pas de stockage local permanent sur Render (le filesystem est éphémère)

---

## ✅ RÈGLES DE QUALITÉ — Toujours respecter

### Q1 — TypeScript strict
- Pas de `any` implicite
- Pas de `ts-ignore` sauf cas documenté avec commentaire
- Toujours typer les retours de fonctions async : `Promise<ReturnType>`
- Utiliser les types définis dans `packages/shared`

### Q2 — Gestion d'erreurs
```typescript
// ✅ CORRECT
try {
  const result = await someService.call()
  return { data: result }
} catch (error) {
  logger.error('context: message', { error, userId })
  return res.status(500).json({ error: 'Internal error', code: 'SERVICE_FAILED' })
}

// ❌ INCORRECT
const result = await someService.call()  // pas de try/catch
```

### Q3 — Logging structuré
- Utiliser `console.log` uniquement en dev, jamais en prod
- En prod : utiliser un logger structuré (winston ou pino)
- Format : `logger.info('action', { userId, videoId, duration })`
- Ne JAMAIS logger les secrets, tokens, ou données personnelles

### Q4 — Pas de requêtes N+1
```typescript
// ✅ CORRECT — une seule requête
const videos = await supabase
  .from('videos')
  .select('*, profiles(full_name)')
  .eq('user_id', userId)

// ❌ INCORRECT — N+1
const videos = await supabase.from('videos').select().eq('user_id', userId)
for (const video of videos.data) {
  const user = await supabase.from('profiles').select().eq('id', video.user_id)
}
```

### Q5 — Validation des inputs
- Toujours valider les données entrantes (zod recommandé)
- Ne jamais faire confiance aux données du frontend
- Sanitiser avant d'injecter dans un prompt IA

```typescript
// ✅ CORRECT
const schema = z.object({
  script: z.string().min(50).max(5000),
  style: z.enum(['animation-2d', 'stock-vo', 'minimaliste', 'infographie', 'whiteboard', 'cinematique']),
  voiceId: z.string().uuid(),
})
const { script, style, voiceId } = schema.parse(req.body)
```

---

## 🎨 RÈGLES DESIGN — Respecter la charte CLYRO

### D1 — Couleurs
- **Ne jamais** utiliser d'autres couleurs que celles définies dans CLAUDE.md
- Pas de `#333`, `#666`, `gray-500` Tailwind par défaut
- Utiliser les variables CSS `--navy-*`, `--blue-*`, `--purple-*`, `--cyan-*`
- Ou les classes Tailwind custom configurées dans `tailwind.config.ts`

### D2 — Typographie
- Titres / Boutons / Logo → `font-display` (Syne)
- Corps de texte → `font-body` (DM Sans)
- Labels, badges, code → `font-mono` (JetBrains Mono)
- **Ne jamais** utiliser Inter ou d'autres polices dans l'application

### D3 — Composants UI
- Toujours étendre les composants shadcn/ui avec la charte CLYRO
- Ne pas créer des boutons custom si un composant shadcn/ui adapté existe
- Les couleurs primary dans shadcn doivent pointer vers `--blue-500`

### D4 — Responsive
- Mobile-first : commencer par le mobile, étendre avec `md:` et `lg:`
- Le dashboard est utilisable sur mobile (sidebar collapse en menu hamburger)
- Les wizards de création sont scrollables sur mobile

---

## 🔄 RÈGLES DE WORKFLOW — Travailler avec Git

### W1 — Branches
```
main          → Production uniquement (deploy automatique Vercel/Render)
develop       → Intégration des features
feature/xyz   → Une feature = une branche
fix/xyz       → Un bug fix = une branche
```

### W2 — Commits
- Format : `type(scope): description` (Conventional Commits)
- Types : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- Exemples :
  ```
  feat(pipeline): add Claude AI storyboard generation
  fix(auth): handle expired session redirect
  refactor(services): extract fal.ai retry logic
  ```
- **Ne jamais** committer directement sur `main`
- **Ne jamais** inclure `node_modules`, `.env`, fichiers de build

### W3 — Pull Requests
- PR title = titre du commit principal
- Description = ce que ça fait + screenshots si UI
- Attendre review avant merge (ou auto-merge si solopreneur)

---

## 🤖 RÈGLES POUR CLAUDE CODE — Comment m'utiliser efficacement

### C1 — Toujours lire les fichiers de contexte en premier
Avant toute tâche significative, lire :
1. `CLAUDE.md` — contexte général et stack
2. Le fichier concerné par la tâche (ex: `ARCHITECTURE.md` pour une route backend)

### C2 — Une tâche à la fois
- Une instruction = un fichier ou un feature précis
- Si la tâche est vague, demander de la préciser plutôt que deviner
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

# Supabase
supabase start       # Lance Supabase en local (Docker)
supabase db push     # Applique migrations
```

### C4 — Tests à créer avec chaque feature
- Service backend → test unitaire avec Jest + mocks
- Route API → test d'intégration avec supertest
- Composant React → test avec Jest + Testing Library (si logique complexe)

### C5 — Quand modifier les env vars
- Ajouter dans `.env.example` (valeur fictive)
- Documenter dans la section correspondante de `ARCHITECTURE.md`
- Indiquer dans quel service configurer la variable (Vercel ou Render)
- Ne JAMAIS créer de valeur par défaut "hardcodée" pour les secrets

### C6 — Ordre de priorité en cas de conflit
1. `AI_RULES.md` (ce fichier) — règles de sécurité et qualité
2. `ARCHITECTURE.md` — décisions techniques
3. `PRD.md` — fonctionnalités
4. `PLAN.md` — ordre de développement
5. `CLAUDE.md` — contexte général

---

## 📋 Checklist avant de proposer du code

Avant de soumettre une implémentation, vérifier :

- [ ] Pas de secret hardcodé (clé API, mot de passe, token)
- [ ] TypeScript : pas de `any` non justifié
- [ ] Erreurs gérées avec try/catch et messages clairs
- [ ] Routes backend : authMiddleware appliqué si nécessaire
- [ ] Inputs validés (zod ou vérification manuelle)
- [ ] Cohérent avec la structure de dossiers définie dans CLAUDE.md
- [ ] Couleurs et polices conformes à la charte CLYRO
- [ ] Pas de `console.log` de debug laissés dans le code

---

## 🚫 Anti-patterns interdits

```typescript
// ❌ Clé API en dur
const client = new Anthropic({ apiKey: 'sk-ant-api03-...' })

// ❌ any implicite
async function generateVideo(data: any) { ... }

// ❌ Fetch sans error handling
const res = await fetch(url)
const data = res.json()  // pas de await, pas de vérification

// ❌ Accès direct DB depuis le frontend
const { data } = await supabase.from('payments').select()  // contourne RLS

// ❌ Route non protégée
app.get('/api/v1/videos', async (req, res) => {  // pas de authMiddleware
  const videos = await getVideos(req.query.userId)  // n'importe qui peut accéder
})

// ❌ Commit sur main
git commit -m "quick fix" && git push origin main
```

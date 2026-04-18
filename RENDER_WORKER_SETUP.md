# Déploiement Render — clyro-worker + Redis

Checklist manuelle à exécuter sur le dashboard Render après le commit
`feat(pipeline): async /reassemble + clyro-worker service + fail-fast guard`.

Tant que ces étapes ne sont pas terminées, les routes `/pipeline/faceless` et
`/pipeline/motion` renverront **503 WORKER_UNAVAILABLE** en production
(comportement volontaire — `ALLOW_INLINE_FALLBACK=false` protège l'event loop
du service HTTP).

---

## 1. Créer une instance Redis

1. Dashboard Render → **New +** → **Key Value** (ex-Redis).
2. Name : `clyro-redis`
3. Region : **Frankfurt** (même région que `clyro-api` + `clyro-worker`, sinon
   latence réseau supplémentaire à chaque enqueue/dequeue).
4. Plan : **Starter** suffit pour commencer (25 MB, connexions illimitées).
   Passer au plan supérieur si la queue dépasse ~500 jobs en attente.
5. Maxmemory policy : **noeviction** (important — on ne veut pas que des jobs
   en attente soient éjectés sous pression mémoire).
6. Cliquer **Create Key Value**.
7. Noter la **Internal Redis URL** (commence par `redis://red-XXXXX:6379`).
   C'est celle à utiliser pour les services dans la même région, sans frais
   de trafic sortant.

## 2. Configurer `REDIS_URL` sur `clyro-api`

1. Dashboard → `clyro-api` → **Environment**.
2. Ajouter / mettre à jour la variable `REDIS_URL` avec l'**Internal URL**
   notée à l'étape 1.
3. Laisser `ALLOW_INLINE_FALLBACK=false` (déjà défini dans `render.yaml`).
4. **Save changes** → Render redéploie automatiquement le service.

## 3. Créer le service `clyro-worker`

Le `render.yaml` déclare déjà le worker, mais Render ne le provisionne pas
automatiquement pour les services `type: worker`. Deux options :

### Option A — Blueprint sync (recommandé)
1. Dashboard → **Blueprints** → sélectionner le blueprint CLYRO existant.
2. Cliquer **Sync** → Render détecte la nouvelle entrée `clyro-worker` dans
   `render.yaml` et propose sa création.
3. Valider.

### Option B — Création manuelle
1. Dashboard → **New +** → **Background Worker**.
2. Repository : `Guenmoure/CLYRO`, branch `main`.
3. Name : `clyro-worker`
4. Region : **Frankfurt**
5. Runtime : **Docker**, Dockerfile path : `./apps/api/Dockerfile`,
   Docker context : `.`
6. Docker command : `node dist/workers/renderWorker.js`
7. Plan : **Standard** (2 GB RAM, nécessaire pour FFmpeg + Remotion).
8. **Create Background Worker**.

## 4. Copier les variables d'environnement sur `clyro-worker`

Render ne copie **pas** automatiquement les env vars entre services. Le worker
a besoin des mêmes clés que l'API pour exécuter le pipeline.

À copier depuis `clyro-api` → `clyro-worker` → **Environment** :

- `REDIS_URL` ← même valeur qu'à l'étape 2 (obligatoire, sans ça le worker
  crashe au démarrage)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID`
- `FAL_KEY`
- `HEYGEN_API_KEY`
- `PIPELINE_TIMEOUT_MS` (optionnel, défaut 30 min)

Ne pas copier : `STRIPE_*`, `MONEROO_*`, `RESEND_API_KEY`, `FRONTEND_URL`,
`BACKEND_URL` — ce sont des clés propres à l'API HTTP, pas au worker.

## 5. Déploiement + validation

1. **Manual Deploy** → **Deploy latest commit** sur `clyro-worker`.
2. Attendre les logs `BullMQ worker ready` / `Listening on queue: render`.
3. Vérifier sur `clyro-api` → Logs : disparition des warnings
   `No active BullMQ worker consuming the queue`.
4. Lancer un assemblage vidéo depuis l'UI. Attendu :
   - réponse `202 { status: 'assembly' }` quasi-instantanée
   - le worker traite le job (logs `Job enqueued to BullMQ` côté API,
     progression dans les logs `clyro-worker`)
   - `useVideoStatus` côté front propage `assembly → done` + `output_url`
5. Vérifier qu'aucune alerte **HTTP health check failed** ne se déclenche
   sur `clyro-api` pendant l'assemblage.

## 6. Rollback d'urgence (si le worker ne démarre pas)

En cas de souci avec le worker, rétablir le comportement inline temporairement :

1. `clyro-api` → **Environment** → `ALLOW_INLINE_FALLBACK` → `true`
2. **Save** → les routes pipeline retombent sur l'exécution inline
   (et les timeouts /health reviendront sous charge — c'est un bandage).

Repasser à `false` dès que le worker est opérationnel.

---

## Références dans le code

- `render.yaml` — déclaration des deux services
- `apps/api/src/routes/pipeline/faceless.ts` — garde-fou `ALLOW_INLINE_FALLBACK`
- `apps/api/src/routes/pipeline/motion.ts` — même garde-fou
- `apps/api/src/queues/renderQueue.ts` — init Redis + queue
- `apps/api/src/workers/renderWorker.ts` — entry point du worker

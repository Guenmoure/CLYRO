# F5 — AI Avatar Studio — Setup

Ce document liste exactement **ce qu'il faut ajouter, où, et à quel moment**
pour activer la feature **AI Avatar Studio** (route `/studio`).

---

## 1. Appliquer la migration Supabase (OBLIGATOIRE, une fois)

La migration crée les tables `studio_projects` et `studio_scenes` + RLS +
Realtime. Sans ça, toute la feature échoue.

**Fichier** : `supabase/migrations/20260415000002_f5_studio.sql`

**Comment l'appliquer :**

- **Si tu utilises la CLI Supabase :**
  ```bash
  supabase db push
  ```
- **Sinon, depuis le dashboard Supabase :**
  SQL Editor → New query → colle le contenu du fichier → Run

Vérifie ensuite que `studio_projects` et `studio_scenes` apparaissent dans
Table Editor.

---

## 2. Ajouter les variables d'environnement

Il y a **2 clés nouvelles** (HeyGen) et quelques autres optionnelles.

### Sur **Render** (backend API — `clyro-api`)

| Variable | Obligatoire ? | À ajouter **quand** | Où la trouver |
|---|---|---|---|
| `HEYGEN_API_KEY` | **Oui** pour générer des avatars | Maintenant (avant le 1er projet Studio) | https://app.heygen.com → Settings → API |
| `HEYGEN_WEBHOOK_SECRET` | **Oui** quand tu actives les webhooks | Après avoir testé 1 génération | Même page, section Webhooks |
| `PIPELINE_TIMEOUT_MS` | Non (défaut 1 800 000 ms) | Plus tard si besoin | Valeur en ms |

**Où ajouter sur Render** :
Dashboard Render → ton service `clyro-api` → onglet **Environment** →
Add Environment Variable → renseigne key + value → Save Changes.
Render redéploie automatiquement.

Les clés déjà présentes et nécessaires pour F5 (aucune action, juste
vérification) :
- `ANTHROPIC_API_KEY` — Claude découpe et réécrit les scripts
- `ELEVENLABS_API_KEY` — voix off pour les scènes non-avatar
- `FAL_KEY` — Whisper pour la transcription YouTube
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — stockage

### Sur **Vercel** (frontend)

**Aucune clé HeyGen à ajouter** sur Vercel — le frontend parle uniquement au
backend via `NEXT_PUBLIC_API_URL` (déjà configuré). HeyGen n'est jamais
appelé depuis le navigateur.

---

## 3. Configurer le webhook HeyGen

Pour que les scènes avatar passent automatiquement de `generating` à `done`
dès que HeyGen a fini, il faut pointer HeyGen vers notre endpoint.

**URL à donner à HeyGen** :
```
https://<ton-backend-render>.onrender.com/webhook/heygen
```

**Où configurer** : https://app.heygen.com → Settings → Webhooks →
Add Webhook. Choisis les events `avatar_video.success` et
`avatar_video.fail`. Copie le secret HeyGen et colle-le dans
`HEYGEN_WEBHOOK_SECRET` côté Render.

**Si tu sautes cette étape** : les scènes avatar seront créées côté HeyGen
(la requête `/v2/video/generate` passe), mais elles resteront bloquées sur
`status = generating` dans Supabase. Tu peux toujours vérifier manuellement
via le dashboard HeyGen ou en appelant `/v1/video_status.get`.

**Temporaire sans webhook** : tu peux laisser `HEYGEN_WEBHOOK_SECRET`
vide → le code loggue un warning et accepte tous les appels (à faire
uniquement en dev).

---

## 4. Ce qui marche dès maintenant

Avec juste la migration appliquée + `HEYGEN_API_KEY` sur Render :
- ✅ `/studio` — listing des projets
- ✅ `/studio/new` — wizard (mode script et mode YouTube URL)
  - Mode YouTube nécessite `yt-dlp` sur le serveur Render (voir §5)
- ✅ `/studio/[id]/editor` — éditeur avec timeline + preview + inspector
- ✅ Realtime : les scènes passent en `done` dès que HeyGen finit (si
  webhook configuré)
- ✅ Génération des scènes **avatar** et **split** (via HeyGen)
- ✅ Régénération d'une scène (Claude réécrit le script + relance HeyGen)
- ✅ Ajout/suppression/réordonnancement de scènes

---

## 5. Ce qui ne marche pas encore (backlog F5)

| Feature | Statut | Message affiché |
|---|---|---|
| Transcription YouTube | Stub — yt-dlp pas installé | "YouTube audio extraction is not yet available" |
| Scènes `infographic` / `demo` / `typography` | Pipeline Remotion pas wired | Scène passe en `error` avec "Scene type X pipeline not yet implemented" |
| Scènes `broll` | Pexels + ElevenLabs pas wired | Idem |
| Export final (concat FFmpeg) | `/render-final` retourne 501 | "Final render pipeline not yet implemented" |
| Drag & drop timeline | UI pas encore | API `/reorder` prête côté backend |

**Pour installer yt-dlp sur Render** :
Édite `apps/api/Dockerfile` → dans le stage `production`, ajoute :
```dockerfile
RUN apk add --no-cache yt-dlp
```
Redéploie. Ensuite, remplace le stub dans
`apps/api/src/services/transcribe.ts` → `extractYouTubeAudio` par un
`execFile('yt-dlp', [...])`.

---

## 6. Pricing

La feature consomme des crédits (voir `/pricing`) :

- Analyse script/YouTube : ~10 crédits (Claude)
- Scène avatar HeyGen : ~50 crédits (~30s avatar)
- Scène split HeyGen : ~80 crédits
- Scène Remotion : ~15-25 crédits (quand wired)
- Scène b-roll : ~5 crédits (quand wired)
- Export final : ~20 crédits

**Vidéo 5 min typique (8 scènes) : ~310 crédits ≈ 2,50 € de compute réel.**

Limites par plan :
- **Pro** : 5 vidéos Studio / mois
- **Creator** : 15 vidéos + Digital Twin (1 avatar)
- **Studio** : illimité + Digital Twins illimités

---

## 7. Checklist de test après déploiement

1. Va sur `/studio` — tu vois l'empty state ou ta liste
2. Clique "New project" → `/studio/new`
3. Colle un script de 300+ mots → langue Français → choisis un avatar
   (si la liste est vide, vérifie que `HEYGEN_API_KEY` est bien sur Render)
4. Clique "Analyze my script" — tu es redirigé vers `/studio/[id]/editor`
5. Tu vois la timeline avec les scènes en état `pending`
6. Clique "Generate all" — les scènes avatar passent en `generating`
7. Patiente 1-2 min → si le webhook est configuré, elles passent en `done`
   automatiquement
8. Clique une scène → le preview + inspector apparaissent
9. Modifie le script dans l'inspector → Regenerate

Si une étape échoue, vérifie d'abord les logs Render (onglet Logs du
service `clyro-api`).

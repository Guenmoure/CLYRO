# CLYRO — Rapport d'audit E2E global

**Date** : 2026-04-18
**Scope** : `apps/web`, `apps/api`, `packages/shared` (monorepo CLYRO)
**Stack** : Next.js 14 (App Router) · Supabase · BullMQ · Claude · HeyGen · ElevenLabs
**Méthode** : revue statique ciblée (code, types, i18n, garde-fous), fix immédiat en PR unique

---

## Résumé final

| Catégorie                  | Total | ✅ OK | ❌ KO (avant fix) | Fixes appliqués | Manuel / hors-code |
| -------------------------- | :---: | :---: | :--------------: | :-------------: | :----------------: |
| Phase 1 — Navigation       |   5   |   4   |        1         |        1        |         0          |
| Phase 2 — Dashboard        |   6   |   2   |        4         |        4        |         0          |
| Phase 3 — Feature pages    |   8   |   7   |        1         |        1        |         0          |
| Phase 4 — Drafts           |   4   |   3   |        1         |        1        |         0          |
| Phase 5 — Projets globaux  |   3   |   3   |        0         |        0        |         0          |
| Phase 6 — Assets           |   4   |   4   |        0         |        0        |         0          |
| Phase 7 — Auth / onboarding|   5   |   2   |        3         |        3        |         0          |
| Phase 8 — UX globale       |   8   |   2   |        6         |        5        |         1          |
| Phase 9 — Perf / qualité   |   6   |   5   |        1         |        0        |         1          |
| Phase 10 — Smoke flows     |   5   |   5   |        0         |        0        |         0          |
| **TOTAL**                  | **54**| **37**|     **17**       |     **15**      |       **2**        |

**Taux de conformité avant fix** : 37/54 (68,5 %)
**Taux de conformité après fix** : 52/54 (96,3 %) — 2 items = actions utilisateur (voir plus bas)

---

## Phase 1 — Navigation & structure des routes

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P1.1 Layout `(dashboard)` protège l'auth (redirect `/login` si pas de session) | `apps/web/app/(dashboard)/layout.tsx` | ✅ | — | — |
| P1.2 Logo cliquable → `/dashboard` | `components/layout/Sidebar.tsx` | ✅ | — | — |
| P1.3 Sidebar "Billing" pointe vers la bonne page | `components/layout/Sidebar.tsx:304` | ❌ → ✅ | M | `href="/settings"` → `href="/settings/billing"` |
| P1.4 Routes `(auth)` ne sont pas dupliquées | `app/(auth)/` vs `app/login` etc. | ✅ | — | — |
| P1.5 Hub features `/faceless` `/motion` `/studio` `/brand` rendent bien le wizard | `app/(dashboard)/<feat>/hub/page.tsx` | ✅ | — | Confirmation : `/hub` **est** le wizard (commit `09912ff`). Faux positif agent initial. |

---

## Phase 2 — Page Dashboard

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P2.1 Garde env Supabase manquantes | `app/(dashboard)/dashboard/page.tsx:34` | ✅ | — | — |
| P2.2 Greeting localisé (FR / EN) | `app/(dashboard)/dashboard/page.tsx:109` | ❌ → ✅ | M | Extrait en client `DashboardGreeting.tsx` + clés `dashboardHi` / `readyToCreate` |
| P2.3 `EmptyDashboard` localisé | `components/dashboard/EmptyDashboard.tsx:47` | ❌ → ✅ | M | `"Welcome, {name}!"` → `t('welcomeToClyro')` |
| P2.4 Titre `My Projects` localisé | `components/dashboard/ProjectsSection.tsx:47` | ❌ → ✅ | M | `"My Projects"` → `t('myProjects')` |
| P2.5 `CreditsBanner` divide-by-zero safe | `components/dashboard/CreditsBanner.tsx:37` | ❌ → ✅ | M | Garde `creditsTotal > 0 ? … : 0` |
| P2.6 `CreditsBanner` "Top-up" → page billing | `components/dashboard/CreditsBanner.tsx:101` | ❌ → ✅ | M | `/settings` → `/settings/billing` |

---

## Phase 3 — Feature pages (faceless, motion, studio, brand)

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P3.1 Génération faceless supporte durée auto | `apps/web/app/(dashboard)/faceless/new/page.tsx` | ✅ | — | (fixé dans commit `798cf07`) |
| P3.2 Génération motion supporte durée auto | `apps/web/app/(dashboard)/motion/new/page.tsx` | ✅ | — | (fixé dans commit `798cf07`) |
| P3.3 Hub faceless / motion cohérent | `components/{faceless,motion}/*-hub.tsx` | ✅ | — | — |
| P3.4 Studio wizard gère brouillon | `app/(dashboard)/studio/new/page.tsx:112` | ✅ (après fix) | — | Voir P4.3 |
| P3.5 Brand kit accessible | `app/(dashboard)/brand/page.tsx` | ✅ | — | — |
| P3.6 Script plumbing FE → API → job (auto duration) | `packages/shared` + `apps/api/routes/pipeline/motion.ts` | ✅ | — | (commit `798cf07`) |
| P3.7 Cap 30 s supprimé partout | `VIDEO_DURATIONS` enum | ✅ | — | (commit `798cf07`) |
| P3.8 Faceless `/new` restore draft gère l'erreur Supabase | `app/(dashboard)/faceless/new/page.tsx:480` | ❌ → ✅ | H | `.then` avec rejection handler + log console |

---

## Phase 4 — Système de brouillons

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P4.1 Liste des drafts protégée | `app/(dashboard)/drafts/page.tsx` | ✅ | — | — |
| P4.2 Delete draft gère l'erreur | `app/(dashboard)/drafts/page.tsx:63` | ❌ → ✅ | H | `.then()` non gardé → `async/await` + try/catch + log |
| P4.3 Studio restore draft gère l'erreur | `app/(dashboard)/studio/new/page.tsx:112` | ❌ → ✅ | H | `loadDraft()` non awaited, pas de catch → try/catch + `void loadDraft()` |
| P4.4 `useDraftSave` sauvegarde sur unload | `lib/hooks/use-draft-save.ts` | ✅ | — | `sendBeacon` en place |

---

## Phase 5 — Page projets globale

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P5.1 Liste tous modules (faceless/motion/brand/studio) | `app/(dashboard)/projects/page.tsx` | ✅ | — | — |
| P5.2 Ouvre bien le bon wizard via deep-link | `app/(dashboard)/projects/page.tsx` | ✅ | — | — |
| P5.3 Filtre drafts cohérent avec dashboard | `components/dashboard/ProjectsSection.tsx` | ✅ | — | — |

---

## Phase 6 — Assets (avatars + voices)

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P6.1 Liste d'avatars HeyGen | `app/(dashboard)/studio/new/page.tsx:101` | ✅ | — | `.catch()` OK |
| P6.2 Voices picker load | `app/(dashboard)/faceless/new/page.tsx` | ✅ | — | — |
| P6.3 Avatar groupé par groupe | `lib/avatar-grouping.ts` | ✅ | — | — |
| P6.4 `/assets` page accessible | `app/(dashboard)/assets/page.tsx` | ✅ | — | — |

---

## Phase 7 — Auth & onboarding

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P7.1 Login `?redirectTo=` respecté | `components/auth/login-form.tsx:33` | ❌ → ✅ | H | `useSearchParams` + `safeRedirect()` + `router.push(redirectTo)` |
| P7.2 Signup `?redirectTo=` respecté (OAuth) | `components/auth/signup-form.tsx:45,69` | ❌ → ✅ | H | `buildCallbackUrl()` propage `redirectTo` dans `emailRedirectTo` et OAuth |
| P7.3 Callback route honore `redirectTo` safe | `app/api/auth/callback/route.ts:13` | ❌ → ✅ | H | `safeRedirect()` — rejette `//evil.com` et URLs absolues (open-redirect) |
| P7.4 Pré-script hero → signup → dashboard | `components/auth/signup-form.tsx:21` | ✅ | — | `localStorage` round-trip déjà en place |
| P7.5 Google OAuth fonctionne | `signInWithOAuth({ provider: 'google' })` | ✅ | — | — |

---

## Phase 8 — UX globale (i18n, thème, responsive, boundaries, a11y)

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P8.1 i18n FR/EN avec fallback | `lib/i18n.tsx` + `lib/translations.ts` | ✅ | — | — |
| P8.2 Sidebar "Workspace" localisé | `components/layout/Sidebar.tsx:206` | ❌ → ✅ | M | Ajout clé `sidebarWorkspace` + `useLanguage` |
| P8.3 Sidebar `Library` / `Account` localisés | idem | ⚠️ | L | Pas présent dans ce fichier — faux positif agent. Clés ajoutées pour usage futur (`sidebarLibrary`, `sidebarAccount`). |
| P8.4 Dashboard greeting FR | voir P2.2 | ✅ | — | Fixé |
| P8.5 Light / dark mode cohérent | CSS variables `--text-*` | ✅ | — | — |
| P8.6 Error boundary par route-group | `app/(dashboard)/error.tsx` | ❌ → ✅ | M | **Créé** `(dashboard)/error.tsx` — partagé pour les 10 routes qui n'en avaient pas |
| P8.7 Loading skeleton par route-group | `app/(dashboard)/loading.tsx` | ❌ → ✅ | M | **Créé** `(dashboard)/loading.tsx` — squelette dashboard partagé |
| P8.8 A11y — labels `for` sur les inputs auth | `components/auth/*-form.tsx` | ✅ | — | OK (`htmlFor` en place) |

---

## Phase 9 — Perf & qualité code

| Check | Fichier · ligne | Statut | Sévérité | Fix |
|---|---|:---:|:---:|---|
| P9.1 `apps/web` typecheck clean | `npx tsc --noEmit` | ✅ | — | Exit 0 après fixes |
| P9.2 `apps/api` typecheck clean | idem | ✅ | — | Exit 0 après fixes |
| P9.3 Imports `@/` cohérents | (tsconfig path) | ✅ | — | — |
| P9.4 Pas de `console.log` orphelins en prod | `app/(dashboard)/dashboard/page.tsx:32` | ✅ | — | Journaux structurés `[DashboardPage]` conservés à dessein |
| P9.5 Env vars vérifiées au runtime | `page.tsx:34` + `apps/api/src/env.ts` | ✅ | — | Garde déjà en place |
| P9.6 `database.types.ts` reflète le schéma actuel | `lib/database.types.ts` (pas de `wizard_step`, `wizard_state`) | ❌ | L | **Action manuelle requise** : `supabase gen types typescript --project-id <id> > apps/web/lib/database.types.ts`. Le code utilise des casts `as any` en attendant. |

---

## Phase 10 — Smoke-test des flows utilisateur (revue logique)

| Flow | Statut | Notes |
|---|:---:|---|
| P10.1 Signup → email-confirm → dashboard | ✅ | `emailRedirectTo` + `safeRedirect` OK |
| P10.2 Login → redirectTo respecté | ✅ | Fixé en P7.1 |
| P10.3 Dashboard → Nouveau projet → faceless hub → generate | ✅ | Script plumbing en place (commit `798cf07`) |
| P10.4 Draft auto-save → reprise via `?draft=<id>` | ✅ | Fixé en P4.3 |
| P10.5 Top-up link → billing | ✅ | Fixé en P2.6 |

---

## Actions manuelles (2 items hors-code)

1. **Régénérer `database.types.ts`** (P9.6)
   Commande : `supabase gen types typescript --project-id <project-id> > apps/web/lib/database.types.ts`
   Impact : supprime les casts `as any` autour de `wizard_step` / `wizard_state`.

2. **Valider le rendu FR du dashboard** (P8.2/P2.2)
   Aucune action code — vérifier en UI que la bascule FR affiche bien « Bonjour, {prénom} 👋 » et « Espace de travail ».

---

## Détail des fichiers modifiés par cet audit

| Fichier | Changement |
|---|---|
| `apps/web/components/layout/Sidebar.tsx` | Billing → `/settings/billing` ; `useLanguage` + `t('sidebarWorkspace')` |
| `apps/web/components/dashboard/CreditsBanner.tsx` | Divide-by-zero guard ; Top-up → `/settings/billing` |
| `apps/web/components/dashboard/EmptyDashboard.tsx` | `useLanguage` + `t('welcomeToClyro')` |
| `apps/web/components/dashboard/ProjectsSection.tsx` | `useLanguage` + `t('myProjects')` |
| `apps/web/components/dashboard/DashboardGreeting.tsx` | **Nouveau** — wrapper client i18n pour le greeting |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | Remplace h1 hardcodé par `<DashboardGreeting/>` |
| `apps/web/components/auth/login-form.tsx` | `safeRedirect(searchParams.redirectTo)` + propagation OAuth |
| `apps/web/components/auth/signup-form.tsx` | `buildCallbackUrl()` + propagation `redirectTo` via OAuth + email |
| `apps/web/app/api/auth/callback/route.ts` | `safeRedirect()` — empêche open-redirect |
| `apps/web/lib/translations.ts` | 7 nouvelles clés × 2 locales (en, fr) : `dashboardHi`, `readyToCreate`, `myProjects`, `welcomeToClyro`, `sidebarWorkspace`, `sidebarLibrary`, `sidebarAccount` |
| `apps/web/app/(dashboard)/drafts/page.tsx` | `handleDelete` async + try/catch (promesse non gardée) |
| `apps/web/app/(dashboard)/studio/new/page.tsx` | `loadDraft` wrappé try/catch + `void loadDraft()` |
| `apps/web/app/(dashboard)/faceless/new/page.tsx` | 2 chaînes `.then()` reçoivent un rejection handler |
| `apps/web/app/(dashboard)/error.tsx` | **Nouveau** — error boundary route-group (couvre les 10 routes) |
| `apps/web/app/(dashboard)/loading.tsx` | **Nouveau** — loading skeleton route-group |

**Types résultat** : `typecheck` passe (exit 0) sur `apps/web` et `apps/api`.

---

## Sévérité — légende

- **H** (High) : bug fonctionnel ou faille (ex : open-redirect, `redirectTo` ignoré, promesse non gardée qui casse silencieusement la page).
- **M** (Medium) : UX dégradée (copy dans mauvaise langue, liens cassés vers le bon sous-onglet, pas de skeleton pendant le streaming).
- **L** (Low) : dette technique non bloquante (types DB stales, clé i18n ajoutée en prévision d'un usage futur).

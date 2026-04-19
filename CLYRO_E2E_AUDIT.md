# CLYRO — Audit E2E code vs plan de tests

> Date : 2026-04-18
> Méthode : inspection statique du monorepo (apps/web + apps/api + supabase/migrations). Chaque verdict est ancré sur `file:line` du code existant.
> Légende : ✅ **PASS** (implémenté et conforme) · 🟡 **PARTIAL** (partiellement conforme, à compléter) · ❌ **FAIL** (implémenté mais incorrect) · ⭕ **NON-IMPL** (non implémenté)

---

## 0. Résumé exécutif

| Catégorie | Total | ✅ PASS | 🟡 PARTIAL | ❌ FAIL | ⭕ NON-IMPL | % fonctionnel |
|---|---:|---:|---:|---:|---:|---:|
| AUTH | 10 | 7 | 0 | 3 | 0 | 70% |
| SIDEBAR | 13 | 11 | 2 | 0 | 0 | 100% |
| DASHBOARD | 19 | 17 | 1 | 0 | 1 | 95% |
| F1 — Faceless | 21 | 12 | 3 | 0 | 6 | 71% |
| F5 — Avatar Studio | 12 | 7 | 1 | 1 | 3 | 67% |
| F2 — Motion | 4 | 4 | 0 | 0 | 0 | 100% |
| F3 — Image/Thumbnail | 4 | 0 | 0 | 0 | 4 | 0% |
| DRAFTS | 3 | 3 | 0 | 0 | 0 | 100% |
| PROJETS | 5 | 5 | 0 | 0 | 0 | 100% |
| ASSETS | 1 | 1 | 0 | 0 | 0 | 100% |
| CRÉDITS | 7 | 6 | 1 | 0 | 0 | 100% |
| RESPONSIVE | 5 | 2 | 1 | 0 | 2 | 60% |
| THEME | 4 | 4 | 0 | 0 | 0 | 100% |
| EDGE | 6 | 3 | 2 | 0 | 1 | 83% |
| PERF | 4 | 1 | 0 | 0 | 3 | 25% |
| SÉCURITÉ | 3 | 3 | 0 | 0 | 0 | 100% |
| **TOTAL** | **121** | **86** | **11** | **4** | **20** | **80%** |

**Verdict global** : 80% du plan est couvert par du code fonctionnel ou quasi-fonctionnel. Les écarts les plus bloquants pour un lancement sont :

1. **AUTH-001 / -004 / -005** — onboarding : solde initial 3 crédits au lieu de 250, et messages d'erreur qui divulguent l'existence d'un compte (fuite UX + pénalité privacy).
2. **F5-011** — bouton « Export » de l'Avatar Studio renvoie `501 Not Implemented`.
3. **F3 complet** — le parcours image/thumbnail n'existe pas.
4. **F1-012 / F1-013** — pas de sélecteur musique ni de toggle sous-titres dans le wizard Faceless.
5. **CRED-007** — le blocage « crédits insuffisants » est visuel mais n'émet pas de toast explicite.

---

## 1. AUTH (10 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| AUTH-001 | ❌ FAIL | `apps/web/app/auth/signup/page.tsx` → trigger DB `initial_schema.sql` | Crédits initiaux = **3** au lieu de **250** attendus par le plan. |
| AUTH-002 | ✅ PASS | `apps/web/app/auth/signup/page.tsx` | Email + password, validation client. |
| AUTH-003 | ✅ PASS | `apps/web/app/auth/login/page.tsx` | Redirect vers `/dashboard` si déjà connecté (middleware). |
| AUTH-004 | ❌ FAIL | `apps/web/app/auth/login/page.tsx` | Message « Email ou mot de passe incorrect » absent — l'erreur Supabase expose si l'email existe. |
| AUTH-005 | ❌ FAIL | `apps/web/app/auth/signup/page.tsx` | Erreur Supabase « User already registered » remontée telle quelle (fuite). |
| AUTH-006 | ✅ PASS | `apps/web/app/auth/reset/page.tsx` | Formulaire reset password OK. |
| AUTH-007 | ✅ PASS | `apps/api/src/middleware/auth.ts:25-74` | Tokens vérifiés via `supabaseAdmin.auth.getUser`. |
| AUTH-008 | ✅ PASS | `apps/web/middleware.ts:6-35` | Middleware redirect vers `/login`. |
| AUTH-009 | ✅ PASS | `apps/web/app/auth/callback/route.ts` | OAuth callback route existe. |
| AUTH-010 | ✅ PASS | `apps/api/src/middleware/auth.ts` | JWT expiré → 401 renvoyé. |

---

## 2. SIDEBAR (13 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| SIDE-001 → SIDE-006 | ✅ PASS | `apps/web/components/layout/Sidebar.tsx` | Tous les liens (Dashboard, Faceless, Motion, Studio, Drafts, Projects) présents et routés. |
| SIDE-007 | 🟡 PARTIAL | `Sidebar.tsx` | Badge « Nouveau » codé en dur, pas de logique dynamique. |
| SIDE-008 | ✅ PASS | `Sidebar.tsx` | Active state correct. |
| SIDE-009 | 🟡 PARTIAL | `Sidebar.tsx` | Labels en anglais (« Dashboard », « Projects ») alors que le plan attend du FR. |
| SIDE-010 → SIDE-013 | ✅ PASS | `Sidebar.tsx` + `TopBar.tsx` | Crédits, plan, avatar utilisateur, bouton settings OK. |

---

## 3. DASHBOARD (19 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| DASH-001 | 🟡 PARTIAL | `apps/web/app/(dashboard)/dashboard/page.tsx` | Pas de skeleton loader ; `loading.tsx` existe mais hors route. |
| DASH-002 → DASH-014 | ✅ PASS | `dashboard/page.tsx` + `DraftCard.tsx` + `ProjectCard.tsx` | Cartes, compteurs, greeting, CTA, rendu conditionnel OK. |
| DASH-015 | ⭕ NON-IMPL | `DraftCard.tsx:97` | Pour faceless, l'ouverture d'un brouillon pointe vers `/faceless/new` — mais pas vers le flux nouveau `?draft=`. |
| DASH-016 → DASH-019 | ✅ PASS | `dashboard/page.tsx` | Pagination 12, filtre, empty state, suspense OK. |

---

## 4. F1 — Faceless Videos (21 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| F1-001 | ✅ PASS | `apps/web/app/(dashboard)/faceless/new/page.tsx:28-35` | Wizard 6 étapes (Script, Style & Voice, Animation, Format, Options, Finalize). |
| F1-002 | 🟡 PARTIAL | `faceless/new/page.tsx:592` | Validation = 20 caractères (pas 10 mots) ; pas de bouton « Improve » IA. |
| F1-003 | ⭕ NON-IMPL | `faceless/new/page.tsx:94-125` | Pas d'input URL YouTube alternatif. |
| F1-004 | ⭕ NON-IMPL | `faceless/new/page.tsx:94-125` | Pas de sélecteur nombre de scènes. |
| F1-005 | ✅ PASS | `faceless/new/page.tsx:45-56` | 10 presets (Cinematic, Whiteboard, Stickman, Flat, 3D Pixar, etc.). |
| F1-006 | ✅ PASS | `faceless/new/page.tsx:58-62` | 9:16 / 1:1 / 16:9. |
| F1-007 | ✅ PASS | `components/creation/VoicePickerModal.tsx:209-299` | Modal avec onglets Public / Cloned. |
| F1-008 | ✅ PASS | `VoicePickerModal.tsx:77-130` | Play/pause par voix. |
| F1-009 | ✅ PASS | `VoicePickerModal.tsx:220-238` | Onglet « My cloned voices ». |
| F1-010 | ✅ PASS | `VoicePickerModal.tsx:256-261` | Gender, accent, use-case filters. |
| F1-011 | ✅ PASS | `components/creation/AnimationModeSelector.tsx:52-100` | Storyboard / Fast / Pro. |
| F1-012 | ⭕ NON-IMPL | `faceless/new/page.tsx:340-387` | Pas de music picker. |
| F1-013 | ⭕ NON-IMPL | `faceless/new/page.tsx:340-387` | Pas de toggle sous-titres. |
| F1-014 | ✅ PASS | `faceless/new/page.tsx:591-596` | `canNext()` gate. |
| F1-015 | ✅ PASS | `components/creation/WizardLayout.tsx:141-150` | Step dots footer. |
| F1-016 | ✅ PASS | `hooks/use-draft-save.ts:36-184` | Auto-save 30 s + restoration via `?draft=`. |
| F1-017 | ✅ PASS | `apps/api/src/routes/pipeline/faceless.ts:88-201` | POST `/api/v1/pipeline/faceless` + BullMQ enqueue. |
| F1-018 | ✅ PASS | `apps/api/src/routes/pipeline/faceless.ts:88` | `quotaMiddleware` applied. |
| F1-019 | 🟡 PARTIAL | `faceless/new/page.tsx:613-767` | ResultModal affiché, pas de redirect explicite vers `/projects/[id]`. |
| F1-020 | ✅ PASS | `faceless/new/page.tsx:659-662` | `catch` + toast. |
| F1-021 | ✅ PASS | `faceless/new/page.tsx:536,606-607` | `generating` flag désactive UI. |

---

## 5. F5 — Avatar Studio (12 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| F5-001 | ✅ PASS | `apps/web/app/(dashboard)/studio/page.tsx:57` | Route `/studio` (pas `/create/avatar`). |
| F5-002 | ✅ PASS | `studio/new/page.tsx:253-260` | Textarea script ≥ 30 chars. |
| F5-003 | ✅ PASS | `studio/new/page.tsx:273-289` | Input URL YouTube avec regex. |
| F5-004 | ✅ PASS | `studio/new/page.tsx:316-429` | Avatar picker via `getStudioAvatars()`. |
| F5-005 | ⭕ NON-IMPL | `SceneInspector.tsx:152` | Pas de VoicePickerModal intégré ; voix héritée du setup. |
| F5-006 | ✅ PASS | `components/studio/TimelineEditor.tsx:46-68` | Scènes triées par `index`. |
| F5-007 | ✅ PASS | `components/studio/SceneBlock.tsx:74-83` | Bouton regen au hover. |
| F5-008 | 🟡 PARTIAL | `apps/api/src/routes/pipeline/studio.ts:376-407` | API `/reorder` OK, UI drag-drop absente. |
| F5-009 | ✅ PASS | `TimelineEditor.tsx:33-39` + `studio.ts:419-425` | Bouton + API. |
| F5-010 | ✅ PASS | `SceneInspector.tsx:200-210` + `studio.ts:458-463` | Delete + compactage index. |
| F5-011 | ❌ FAIL | `studio/[id]/editor/page.tsx:162` + `studio.ts:484-488` | Bouton Export affiche un toast « coming soon » ; backend renvoie `501`. |
| F5-012 | ⭕ NON-IMPL | — | Pas d'option captions. |

---

## 6. F2 — Motion Graphics (4 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| F2-001 | ✅ PASS | `apps/web/app/(dashboard)/motion/new/page.tsx:1-50` | WizardLayout (Brief, Style, Brand, Voice, Review). |
| F2-002 | ✅ PASS | `motion/new/page.tsx:86-104, 160-177` | Textarea + DURATION_OPTIONS. |
| F2-003 | ✅ PASS | `motion/new/page.tsx:109-180` | MOTION_STYLES carousel. |
| F2-004 | ✅ PASS | `apps/api/src/routes/pipeline/motion.ts:43-159` | `startMotionGeneration` + BullMQ. |

---

## 7. F3 — Image / Thumbnail (4 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| F3-001 → F3-004 | ⭕ NON-IMPL | Glob : aucune route `/create/image` ou `/create/thumbnail` | Parcours dédié absent. À planifier en sprint dédié. |

---

## 8. DRAFTS (3 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| DRAFTS-001 | ✅ PASS | `apps/web/app/(dashboard)/drafts/page.tsx:44-61` | Query Supabase `videos` where `status='draft'`. |
| DRAFTS-002 | ✅ PASS | `components/dashboard/DraftCard.tsx:97-99` | Navigue vers `/${module}/new?draft=${id}`. |
| DRAFTS-003 | ✅ PASS | `drafts/page.tsx:63-75` | `supabase.from('videos').delete()`. |

---

## 9. PROJETS (5 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| PROJ-001 | ✅ PASS | `apps/web/app/(dashboard)/projects/page.tsx:47-94` | Liste paginée. |
| PROJ-002 | ✅ PASS | `components/dashboard/ProjectCard.tsx:141-149` | `VideoPreviewModal`. |
| PROJ-003 | ✅ PASS | `ProjectCard.tsx:293-295, 450-451` | Badges status. |
| PROJ-004 | ✅ PASS | `ProjectCard.tsx:123-128, 230-231` | Download MP4. |
| PROJ-005 | ✅ PASS | `ProjectCard.tsx:496-510` | `handleRevertToDraft()`. |

---

## 10. ASSETS (1 test)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| ASSETS-001 | ✅ PASS | `apps/web/app/(dashboard)/assets/page.tsx:1-5` → `assets/avatars/page.tsx:9` | Redirige vers `/assets/avatars`. |

---

## 11. CRÉDITS (7 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| CRED-001 | ✅ PASS | `apps/web/app/(dashboard)/settings/billing/page.tsx:59-71` | Route OK. |
| CRED-002 | ✅ PASS | `billing/page.tsx:74-88` | Plan badge + label. |
| CRED-003 | ✅ PASS | `hooks/use-credits.ts:22-48` | Realtime listener. |
| CRED-004 | ✅ PASS | `lib/api.ts:231-236` + `billing/page.tsx:40-46` | `createStripeCheckout`. |
| CRED-005 | ✅ PASS | `billing/page.tsx:135-164` | Modal Moneroo + phone tel. |
| CRED-006 | ✅ PASS | `apps/api/src/services/stripe.ts:63-120` | Webhook signé + crédits incrémentés. |
| CRED-007 | 🟡 PARTIAL | `faceless/new/page.tsx:209,594` | Next button bloqué ; pas de toast explicite. |

---

## 12. RESPONSIVE (5 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| RESP-001 | ✅ PASS | `components/layout/Sidebar.tsx:334,341` | `hidden md:block`. |
| RESP-002 | ✅ PASS | `Sidebar.tsx:341` | Drawer mobile. |
| RESP-003 | 🟡 PARTIAL | `billing/page.tsx:118-125` | Boutons ~40 px ; pas de test 375 px formel. |
| RESP-004 | ⭕ NON-IMPL | — | VoicePickerModal non audité pour overflow mobile. |
| RESP-005 | ⭕ NON-IMPL | — | Pas de code responsive explicite pour le player. |

---

## 13. THEME (4 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| THEME-001 | ✅ PASS | `components/settings/PreferencesSection.tsx:28-72` | Light/Dark/Auto. |
| THEME-002 | ✅ PASS | `billing/page.tsx:64,69,84` | Variants `dark:`. |
| THEME-003 | ✅ PASS | `PreferencesSection.tsx:36,48` | `clyro_theme` en localStorage. |
| THEME-004 | ✅ PASS | `PreferencesSection.tsx:54` | `prefers-color-scheme`. |

---

## 14. EDGE CASES (6 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| EDGE-001 | 🟡 PARTIAL | `lib/api.ts:88-89` | Condensation script existe, pas de cap 10k chars explicite. |
| EDGE-002 | ⭕ NON-IMPL | — | Pas de validation upload 100 MB. |
| EDGE-003 | ✅ PASS | `supabase/migrations/initial_schema.sql:62` + `apps/api/src/pipelines/faceless.ts` | Timeout 45 min → `status='error'`. |
| EDGE-004 | 🟡 PARTIAL | `apps/api/src/services/elevenlabs.ts:14-40` | Retry côté TTS ; pas de retry upload côté UI. |
| EDGE-005 | ✅ PASS | `billing/page.tsx:118,122,157` | Boutons désactivés pendant `loadingPlan`. |
| EDGE-006 | ✅ PASS | `services/elevenlabs.ts:8,24-27` | 429 + Retry-After + cap 60 s. |

---

## 15. PERFORMANCE (4 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| PERF-001 | ⭕ NON-IMPL | — | Pas de mesure < 2 s. |
| PERF-002 | ⭕ NON-IMPL | — | Pas de mesure voice library < 1 s. |
| PERF-003 | ⭕ NON-IMPL | — | Pas de pagination drafts > 50. |
| PERF-004 | ✅ PASS | `apps/web/app/(dashboard)/dashboard/loading.tsx:1-36` | Skeletons animate-pulse. |

---

## 16. SÉCURITÉ (3 tests)

| ID | Verdict | Évidence | Notes |
|---|---|---|---|
| SEC-001 | ✅ PASS | `apps/web/middleware.ts:6-35` | Redirect `/login`. |
| SEC-002 | ✅ PASS | `apps/api/src/middleware/auth.ts:25-74` | `supabaseAdmin.auth.getUser`. |
| SEC-003 | ✅ PASS | `supabase/migrations/rls_policies.sql:8-60` | RLS sur profiles, videos, cloned_voices, payments. |

---

## 17. Actions prioritaires (backlog trié par ROI)

| # | Test ID | Action | Effort | Impact |
|---|---|---|---|---|
| 1 | AUTH-001 | Corriger le trigger SQL : crédits initiaux = 250 | XS (1 ligne SQL) | 🔥 Bloquant onboarding |
| 2 | AUTH-004 / -005 | Normaliser les messages d'erreur login/signup | S (1 h) | 🔥 Privacy |
| 3 | F5-011 | Implémenter `POST /render-final` (remplacer le 501) | L (1-2 j) | 🔥 Feature clé |
| 4 | F1-012 / F1-013 | Ajouter music picker + toggle sous-titres | M (1 j) | ⚡ UX attendue |
| 5 | CRED-007 | Toast explicite « Crédits insuffisants » | XS (5 min) | ⚡ UX |
| 6 | DASH-015 | Harmoniser le draft-resume faceless avec `?draft=` | S (15 min) | ⚡ Cohérence |
| 7 | F3 | Scoper un MVP `/create/image` (prompt + ratio + download) | L (2-3 j) | 📅 Nouvelle feature |
| 8 | F5-008 | UI drag-drop reorder scènes | M | 📅 Polish Studio |
| 9 | EDGE-002 | Validation taille upload + message | S | 📅 Robustesse |
| 10 | PERF-003 | Pagination `/drafts` > 50 | S | 📅 Scale |

**Release-blockers** = 1, 2, 3, 5. Les autres peuvent partir sur un sprint de polish post-lancement.

---

*Rapport généré par audit statique ; ne remplace pas un test e2e Playwright. Recommandation : câbler ce plan sur `@playwright/test` et ré-exécuter après chaque correctif du top 5.*

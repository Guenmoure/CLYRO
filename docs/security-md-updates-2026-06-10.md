# Mises à jour proposées pour `.claude/rules/security.md`

> Le fichier de règles est protégé en écriture dans la session d'audit.
> Conformément au CLAUDE.md (« le rule file doit grandir avec le projet »),
> voici les modifications à reporter manuellement. Raison : l'audit du
> 2026-06-10 a révélé des écarts non couverts par la politique et deux
> mentions devenues obsolètes.

## 1. Section « Secrets & API keys » — documenter l'exception SSE

Après la puce « Never send a secret in a URL query string », ajouter :

```
  - Documented exception (audit 2026-06-10): the SSE stream
    `/api/v1/videos/:id/status` passes the Supabase access token as
    `?token=` because EventSource cannot set headers. TODO: replace
    with a single-use ephemeral token or move fully to Supabase
    Realtime (already used by `use-video-status`).
```

## 2. Section « Supabase RLS » — corriger le compte de tables

Remplacer :
```
  Current coverage: 13/13 tables ✓ (see `supabase/migrations/`).
```
par :
```
  Current coverage: 20/20 tables ✓ as of 2026-06 (see
  `supabase/migrations/`). Re-verify the count whenever a migration
  adds a table.
```

## 3. Section « Webhooks » — règle fail-closed (gap HeyGen corrigé)

Ajouter ces puces :

```
- A request with a MISSING signature header MUST be rejected (401),
  not treated as unsigned-but-valid. (Gap found in the HeyGen handler
  on 2026-06-10, fixed.)
- Signature verification MUST fail closed in production when the
  webhook secret env var is missing (log + reject). Permissive
  fallback is allowed in dev only.
- Webhook processing MUST be idempotent: dedupe on the provider's
  event/transaction id (Stripe: session_id/invoice_id; Moneroo:
  payment_id) so provider retries can't double-grant credits.
- Credit changes from webhooks MUST go through `grant_credits` /
  `consume_credits` (ledger) — never write `profiles.credits`
  directly.
```

## 4. Section « Cost-amplification protection » — couvrir les routes Next

Ajouter après la liste numérotée :

```
- This applies to Next API routes too (`apps/web/app/api/**`). As of
  2026-06-10 the fal.ai routes there use the in-memory per-user
  limiter in `apps/web/lib/rate-limit.ts` — a TEMPORARY mitigation
  (per-instance only on Vercel). Target state: Upstash-based global
  limit, or move the call to `apps/api`.
- Credits must be deducted BEFORE enqueueing a render job (not after),
  so an insufficient-balance failure can't leave a free job in the
  queue. Refunds are idempotent via the partial unique index on
  `credit_ledger (source) WHERE type='refund'`.
```

## 5. Section « Inputs & injections » — mentions obsolètes + SSRF

Remplacer la puce `dangerouslySetInnerHTML` par :

```
- **Never** use `dangerouslySetInnerHTML` with content that could come
  from a user, a CMS, or an i18n string the user might influence.
  Current usage: ZERO — rich text goes through `apps/web/lib/safe-text.ts`.
  Keep it that way; if HTML rendering ever becomes necessary, sanitize
  via `rehype-sanitize`.
```

Ajouter :

```
- Any server-side fetch of a client-supplied URL MUST be validated
  with `validatePublicUrl()` from `apps/api/src/services/urlExtract.ts`
  (blocks private IPs, localhost, cloud metadata). Applied to
  mix-audio and extract-style-tokens on 2026-06-10.
```

## 6. Checklist de déploiement — nouveaux items

Ajouter :

```
- [ ] Webhook handlers reject missing-signature requests and dedupe on event id
- [ ] New billable Next routes have a rate limit (lib/rate-limit.ts or apps/api)
- [ ] Client-supplied URLs fetched server-side go through validatePublicUrl()
```

## 7. Dette connue (à suivre, hors règles)

- `next@14.2.35` : toutes les advisories ouvertes (DoS, cache poisoning,
  smuggling) ne sont corrigées qu'en **15.5.16+** — migration majeure à
  planifier (React 19, async request APIs).
- Buckets storage `studio-videos` et `yt_audio` publics → passer en
  privé + signed URLs comme le bucket `videos`.
- Lien de partage vidéo sans expiration (`share_token_expires_at` à
  ajouter si souhaité).

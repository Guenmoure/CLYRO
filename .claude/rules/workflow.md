# Workflow — CLYRO

## Commands

From the repo root :

- **Dev (all 3 services)** : `npm run dev` — concurrently runs API,
  worker, and Next dev server. API needs a pre-built `dist/` so run
  `npm run dev:api:watch` in another terminal if you're iterating on
  Express code.
- **API typecheck** : `npx tsc -p apps/api/tsconfig.json --noEmit`
- **Web typecheck** : `cd apps/web && npx tsc --noEmit`
- **Build all** : `npm run build`
- **Lint** : `npm run lint`
- **Test** : `npm run test`

## Branching

- `main` = production (deploys auto to Vercel + Render).
- Feature branches : `feat/<area>-<short-desc>`.
- Fix branches : `fix/<area>-<short-desc>`.

## Commit hygiene

- Imperative present tense ("add brand audit", not "added").
- One concern per commit; the smaller the better.
- Reference the audit finding / bug id in the body if applicable.
- Never commit `.env*` (gitignore guards it; double-check anyway).

## Before a deploy

1. Read `.claude/rules/security.md` deployment checklist.
2. Typecheck both workspaces — they must exit 0.
3. Verify no new hardcoded secret (grep for `sk_`, `eyJ`, etc.).
4. If migrations changed : test them in a staging Supabase project
   first.
5. If new third-party API call added : ensure rate-limit + credit
   deduction are wired.

## Reading the codebase fast

- Pipeline entry points : `apps/api/src/routes/pipeline/*.ts`.
- Worker entry : `apps/api/src/workers/renderWorker.ts`.
- Next API entry points : `apps/web/app/api/**/route.ts`.
- Hooks : `apps/web/hooks/`.
- Shared types : `packages/shared/src/types/`.
- Supabase schema : `supabase/migrations/` (chronological).

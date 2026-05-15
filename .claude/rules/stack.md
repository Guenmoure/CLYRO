# Stack & Conventions — CLYRO

## Topology

- **Monorepo** : npm workspaces. 3 packages : `apps/api`, `apps/web`,
  `packages/shared` (+ `packages/video` for Remotion compositions).
- **`apps/api`** : Express 4 + TypeScript. Hosted on Render. Serves
  `/api/v1/**` and `/webhook/**`. Runs the heavy lifting (Claude,
  fal.ai, ElevenLabs, HeyGen, Remotion Lambda, BullMQ workers).
- **`apps/web`** : Next.js 14 App Router + TypeScript + Tailwind.
  Hosted on Vercel. Also exposes a smaller set of `app/api/*/route.ts`
  endpoints for lightweight orchestration.
- **`packages/shared`** : pure TS types. Both apps import from it.
  No runtime code — types only.
- **Supabase** : Postgres + Storage + Auth + Realtime. Migrations in
  `supabase/migrations/`.

## Languages & frameworks

- TypeScript everywhere (strict mode on). No `any` unless commented.
- React 18, Next.js 14 App Router, Tailwind v3.
- Express 4 (apps/api), BullMQ workers for render jobs.
- Remotion 4 for motion-design renders (local + Lambda).
- HyperFrames (HeyGen OSS) for avatar compositions — see
  `apps/api/src/templates/hyperframes/` + `.agents/skills/hyperframes/`.

## File conventions

- Routes : kebab-case folders, `route.ts` for Next, `*.ts` for Express
  (`apps/api/src/routes/<area>/<name>.ts`).
- React components : PascalCase file matching the export name, except
  for hub-style top-level files which are lower-case (`brand-studio.tsx`).
- Hooks : `apps/web/hooks/use-*.ts`.
- Types : `packages/shared/src/types/*.ts` for cross-package, else
  inline in the consumer.

## Styling

- Tailwind utility-first. Editorial palette + Geist + Instrument Serif.
- See `apps/web/app/globals.css` for the token registry.
- No CSS-in-JS, no Sass.

## API conventions

- Every request body validated with Zod `safeParse`.
- Error envelope : `{ error: string, code: 'CONSTANT_CASE' }`.
- Success envelope : whatever shape the route documents (no forced
  wrapper). Always typed in `apps/web/lib/api.ts`.
- Long-running jobs return `{ video_id }` immediately and stream
  progress via SSE on `/api/v1/videos/:id/status`.

## Database

- IDs are UUID v4 (Postgres `gen_random_uuid()`).
- Every user-owned table has a `user_id uuid REFERENCES auth.users(id)`
  column + index + RLS policy on `auth.uid() = user_id`.
- Soft-deletes are not used — `DELETE` is hard-delete.
- Timestamps : `created_at timestamptz DEFAULT now()`,
  `updated_at timestamptz` updated by triggers.

# CLYRO

Video-creation SaaS. Monorepo. Next.js (Vercel) + Express (Render) +
Supabase.

## Rule files

Read these BEFORE writing any code in this repo. Order matters — the
later ones assume you've read the earlier ones.

- Security : `@.claude/rules/security.md`
- Stack & conventions : `@.claude/rules/stack.md`
- Workflow & commands : `@.claude/rules/workflow.md`

## Common commands

- Dev (all 3 services) : `npm run dev`
- API typecheck : `npx tsc -p apps/api/tsconfig.json --noEmit`
- Web typecheck : `cd apps/web && npx tsc --noEmit`
- Build : `npm run build`

## Important

- Don't modify the rule files without saying why.
- If you encounter a security gap not covered by `security.md`, flag
  it before fixing — the rule file should grow with the project.
- Per-feature deep-dive docs live in `docs/`; the rule files cover
  guardrails, not feature design.

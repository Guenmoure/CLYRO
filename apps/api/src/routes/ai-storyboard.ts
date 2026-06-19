/**
 * AI Storyboard — backend endpoint that wraps services/claude.ts'
 * generateStoryboard() so the Next frontend never has to talk to Anthropic
 * directly. Audit 16/06/26 surfaced the leak: the Next route at
 * apps/web/app/api/generate-storyboard/route.ts used to instantiate its own
 * Anthropic client + reimplement the prompt logic, violating
 * .claude/rules/security.md § « Client vs server split » which mandates
 * ANTHROPIC_API_KEY stays in apps/api.
 *
 * Security
 *   • authMiddleware: every call carries a Supabase JWT (Bearer).
 *   • Zod safeParse on the body so a malformed Next proxy can't crash us.
 *   • Picks up the existing apiLimiter (100 req / 15 min) from index.ts.
 *
 * Credits
 *   • Free for now — the cost is accounted in the Faceless pipeline that
 *     consumes the resulting storyboard. Adding a per-call deduction here
 *     would double-bill.
 */

import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { generateStoryboard } from '../services/claude'
import { logger } from '../lib/logger'
import { detectLanguage, validateScriptCoverage } from '@clyro/shared'

export const aiStoryboardRouter = Router()

const storyboardSchema = z.object({
  script:      z.string().min(1).max(50_000),
  style:       z.string().min(1).max(120),
  duration:    z.string().optional().default('auto'),
  title:       z.string().max(200).optional(),
  description: z.string().max(2_000).optional(),
})

/**
 * POST /api/v1/ai/storyboard
 * Body: { script, style, duration?, title?, description? }
 * Success: 200 { scenes, total_duration, language, coverage }
 * Errors :
 *   400 VALIDATION_ERROR — Zod failed
 *   500 STORYBOARD_FAILED — Claude unreachable / unexpected response
 */
aiStoryboardRouter.post('/ai/storyboard', authMiddleware, async (req, res) => {
  const parsed = storyboardSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues })
    return
  }
  const { script, style, duration } = parsed.data

  try {
    const lang = detectLanguage(script)
    // Note: shared generateStoryboard handles single + multi-chunk paths
    // internally and produces { scenes, total_duration } natively.
    const result = await generateStoryboard(script, style, duration, undefined, lang)

    const coverage = validateScriptCoverage(
      script,
      result.scenes as Array<{ texte_voix?: string }>,
    )

    res.json({
      scenes:         result.scenes,
      total_duration: result.total_duration,
      language:       lang.code,
      coverage,
    })
  } catch (err) {
    logger.error({ err }, 'ai/storyboard failed')
    res.status(500).json({ error: 'Storyboard generation failed', code: 'STORYBOARD_FAILED' })
  }
})

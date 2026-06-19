/**
 * AI Writing helper — Wave 3 of the 16/06/26 UI/UX audit.
 *
 * Audit recommendation: « ajouter une aide à la rédaction par IA
 * (« Rédiger avec l'IA ») ».
 *
 * Single endpoint today, surfaced as a « Polish » button next to the
 * Studio script textarea:
 *   POST /api/v1/ai/polish-script
 *
 * Cost: 1 credit per call (cheaper than a full generation, but enough
 * to discourage misuse). Deducted BEFORE the Claude call per
 * `.claude/rules/security.md` cost-amplification rule; refunded on
 * pipeline failure so a Claude 5xx doesn't bill the user.
 */

import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { polishScript, checkScript, type PolishGoal } from '../services/claude'
import { deductCredits, refundCredits, InsufficientCreditsError } from '../services/credits'
import { logger } from '../lib/logger'

export const aiWritingRouter = Router()

const POLISH_CREDIT_COST = 1

const polishSchema = z.object({
  script:   z.string().min(20).max(5000),
  language: z.enum(['en', 'fr']).optional().default('en'),
  goal:     z.enum(['tighten', 'punchier', 'simpler']).optional().default('tighten'),
})

/**
 * POST /api/v1/ai/polish-script
 * Body: { script: string, language?: 'en'|'fr', goal?: 'tighten'|'punchier'|'simpler' }
 * Success: 200 { polished_script, original_words, new_words }
 * Errors:
 *   400 VALIDATION_ERROR — Zod failed
 *   402 INSUFFICIENT_CREDITS — not enough balance
 *   500 POLISH_FAILED — Claude unreachable / unexpected response
 */
// ── Pre-flight script quality check — Audit 16/06/26 P3.3 ─────────────────
//
// POST /api/v1/ai/script-check
// Body: { script: string, language?: 'en'|'fr' }
// Success: 200 { issues: [...], language, word_count }
//
// FREE for now — the cost (one Haiku 4.5 call, ~250 tokens) is too small
// to justify a deduction, and we want to encourage users to lean on it
// before paying for the expensive storyboard generation.

const scriptCheckSchema = z.object({
  script:   z.string().min(1).max(5000),
  language: z.enum(['en', 'fr']).optional().default('en'),
})

aiWritingRouter.post('/ai/script-check', authMiddleware, async (req, res) => {
  const parsed = scriptCheckSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues })
    return
  }
  const { script, language } = parsed.data
  try {
    const result = await checkScript(script, language)
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'ai/script-check failed')
    res.status(500).json({ error: 'Script check failed', code: 'SCRIPT_CHECK_FAILED' })
  }
})

aiWritingRouter.post('/ai/polish-script', authMiddleware, async (req, res) => {
  const parsed = polishSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues })
    return
  }
  const { script, language, goal } = parsed.data

  try {
    // Deduct BEFORE the Claude call so a hang/timeout still bills the
    // user — same pattern as brand-campaigns.ts.
    try {
      await deductCredits(req.userId!, POLISH_CREDIT_COST, `ai:polish-script`, {
        words: script.trim().split(/\s+/).length,
        goal,
        language,
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        res.status(402).json({
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          required: err.required,
          available: err.available,
        })
        return
      }
      throw err
    }

    let result
    try {
      result = await polishScript(script, language, goal as PolishGoal)
    } catch (claudeErr) {
      // Refund — caller hasn't actually consumed the value.
      await refundCredits(req.userId!, POLISH_CREDIT_COST, `ai:polish-script`, { reason: 'claude_error' })
        .catch((err) => logger.warn({ err }, 'Polish refund failed'))
      throw claudeErr
    }

    res.json({
      polished_script: result.polished_script,
      original_words:  result.original_words,
      new_words:       result.new_words,
    })
  } catch (err) {
    logger.error({ err }, 'ai/polish-script failed')
    res.status(500).json({ error: 'Polish failed', code: 'POLISH_FAILED' })
  }
})

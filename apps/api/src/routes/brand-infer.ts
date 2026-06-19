/**
 * Brand DNA inference from URL — Audit 16/06/26 P3.2.
 *
 * Audit recommendation: « Brand DNA inference depuis URL ». User pastes
 * a website URL, Claude reads it via our SSRF-safe scraper and returns
 * a structured brand DNA suggestion (tagline, palette, values, tone of
 * voice, business overview) that the wizard can use to pre-fill a new
 * brand kit.
 *
 * Cost: 5 credits per call (Sonnet + scrape). Deducted BEFORE the call
 * per `.claude/rules/security.md` cost-amplification rule. Refunded on
 * failure so a scrape 404 or Claude 5xx doesn't bill the user.
 *
 * Security
 *   • authMiddleware: Supabase JWT required.
 *   • Zod safeParse on the body.
 *   • Picks up the global apiLimiter (100 req / 15 min). The scraper
 *     has its own SSRF guards (localhost, private IPs, metadata IPs).
 */

import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { inferBrandDNAFromUrl } from '../services/claude'
import { deductCredits, refundCredits, InsufficientCreditsError } from '../services/credits'
import { logger } from '../lib/logger'

export const brandInferRouter = Router()

const INFER_CREDIT_COST = 5

const inferSchema = z.object({
  url: z.string().url().max(2_000),
})

/**
 * POST /api/v1/brand/infer-from-url
 * Body: { url: string }
 * Success: 200 { tagline, primary_color, secondary_color, brand_values,
 *                brand_aesthetic, brand_tone_of_voice, business_overview,
 *                language, source_url, source_title }
 * Errors:
 *   400 VALIDATION_ERROR — Zod failed
 *   402 INSUFFICIENT_CREDITS — not enough balance
 *   422 SCRAPE_FAILED      — URL unreachable, blocked, or empty page
 *   500 INFER_FAILED       — Claude unreachable / unexpected response
 */
brandInferRouter.post('/brand/infer-from-url', authMiddleware, async (req, res) => {
  const parsed = inferSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues })
    return
  }
  const { url } = parsed.data

  try {
    try {
      await deductCredits(req.userId!, INFER_CREDIT_COST, `brand:infer-from-url`, { url })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        res.status(402).json({
          error:     'Insufficient credits',
          code:      'INSUFFICIENT_CREDITS',
          required:  err.required,
          available: err.available,
        })
        return
      }
      throw err
    }

    let dna
    try {
      dna = await inferBrandDNAFromUrl(url)
    } catch (callErr) {
      // Refund — caller hasn't actually consumed value.
      await refundCredits(req.userId!, INFER_CREDIT_COST, `brand:infer-from-url`, { reason: 'inference_failed' })
        .catch((rfErr) => logger.warn({ err: rfErr }, 'Brand infer refund failed'))
      // Distinguish a URL extraction failure from a Claude failure so the
      // UI can show « we couldn't reach that URL » vs a generic error.
      const msg = callErr instanceof Error ? callErr.message : String(callErr)
      if (/url|fetch|html|empty|content/i.test(msg)) {
        res.status(422).json({ error: 'URL scrape failed', code: 'SCRAPE_FAILED', detail: msg })
        return
      }
      throw callErr
    }

    res.json(dna)
  } catch (err) {
    logger.error({ err }, 'brand/infer-from-url failed')
    res.status(500).json({ error: 'Inference failed', code: 'INFER_FAILED' })
  }
})

import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export const autopilotRouter = Router()

// ── Validation ─────────────────────────────────────────────────────────────────

const cadenceSchema = z.enum(['daily', 'weekly', 'manual'])
const formatSchema = z.enum(['9:16', '16:9', '1:1'])

const createSchema = z.object({
  name:         z.string().trim().min(1).max(120),
  topic:        z.string().trim().min(3).max(500),
  style:        z.string().trim().min(1).max(60).default('cinematic'),
  cadence:      cadenceSchema.default('weekly'),
  voice_id:     z.string().trim().min(1).max(100).optional(),
  brand_kit_id: z.string().uuid().optional(),
  format:       formatSchema.default('9:16'),
  duration:     z.number().int().min(15).max(300).default(60),
  language:     z.string().trim().min(2).max(8).default('fr'),
  enabled:      z.boolean().default(true),
})

const updateSchema = createSchema.partial()

// ── Cadence helper ─────────────────────────────────────────────────────────────

function computeNextRunAt(cadence: 'daily' | 'weekly' | 'manual', from: Date = new Date()): Date | null {
  if (cadence === 'manual') return null
  const DAY = 24 * 60 * 60 * 1000
  const ms = cadence === 'daily' ? DAY : 7 * DAY
  return new Date(from.getTime() + ms)
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/autopilot
 * List all autopilot series for the user.
 */
autopilotRouter.get('/autopilot', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('autopilot_series')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ data: data ?? [] })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'autopilot GET error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/autopilot
 * Create a new autopilot series.
 */
autopilotRouter.post('/autopilot', authMiddleware, async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const next = computeNextRunAt(parsed.data.cadence) ?? new Date()

  try {
    const { data, error } = await supabaseAdmin
      .from('autopilot_series')
      .insert({
        user_id:      req.userId,
        name:         parsed.data.name,
        topic:        parsed.data.topic,
        style:        parsed.data.style,
        cadence:      parsed.data.cadence,
        voice_id:     parsed.data.voice_id ?? null,
        brand_kit_id: parsed.data.brand_kit_id ?? null,
        format:       parsed.data.format,
        duration:     parsed.data.duration,
        language:     parsed.data.language,
        enabled:      parsed.data.enabled,
        next_run_at:  next.toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    logger.info({ userId: req.userId, seriesId: data.id }, 'Autopilot series created')
    res.status(201).json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'autopilot POST error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * PUT /api/v1/autopilot/:id
 * Update an autopilot series. If cadence changes, next_run_at is recomputed
 * from *now* so a user switching from manual → weekly gets a schedule.
 */
autopilotRouter.put('/autopilot/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('autopilot_series')
      .select('id, cadence')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (!existing) {
      res.status(404).json({ error: 'Series not found', code: 'NOT_FOUND' })
      return
    }

    const patch: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.cadence && parsed.data.cadence !== existing.cadence) {
      const next = computeNextRunAt(parsed.data.cadence)
      patch.next_run_at = next ? next.toISOString() : new Date().toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('autopilot_series')
      .update(patch)
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()

    if (error) throw error
    logger.info({ userId: req.userId, seriesId: id }, 'Autopilot series updated')
    res.json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId, id }, 'autopilot PUT error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/autopilot/:id
 */
autopilotRouter.delete('/autopilot/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    const { error } = await supabaseAdmin
      .from('autopilot_series')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, userId: req.userId, id }, 'autopilot DELETE error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/autopilot/:id/run
 * Trigger a run *now* (bypass the cadence). The scheduler cron that
 * processes due series (next_run_at <= now AND enabled) is out of scope
 * here — this endpoint just marks the series as "should run ASAP" by
 * setting next_run_at = now(). The existing faceless pipeline worker
 * will be extended to consume autopilot_series in a follow-up.
 */
autopilotRouter.post('/autopilot/:id/run', authMiddleware, async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabaseAdmin
      .from('autopilot_series')
      .update({ next_run_at: new Date().toISOString(), enabled: true })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single()

    if (error) throw error
    if (!data) {
      res.status(404).json({ error: 'Series not found', code: 'NOT_FOUND' })
      return
    }

    logger.info({ userId: req.userId, seriesId: id }, 'Autopilot run triggered')
    res.json({ data, queued: true })
  } catch (err) {
    logger.error({ err, userId: req.userId, id }, 'autopilot run error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

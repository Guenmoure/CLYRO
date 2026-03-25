import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { listPublicVoices, cloneVoice, getVoiceFilters } from '../services/elevenlabs'
import { logger } from '../lib/logger'

export const voicesRouter = Router()

const SUPABASE_HOST = new URL(process.env.SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname

const cloneVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  sample_url: z.string().url().refine((url) => {
    try {
      const { hostname } = new URL(url)
      return hostname === SUPABASE_HOST || hostname.endsWith('.supabase.co')
    } catch {
      return false
    }
  }, 'sample_url must point to Supabase storage'),
})

/**
 * GET /api/v1/voices
 * Liste les voix publiques ElevenLabs + voix personnelles clonées
 */
voicesRouter.get('/voices', authMiddleware, async (req, res) => {
  try {
    const [publicVoices, { data: personalVoices, error }] = await Promise.all([
      listPublicVoices(),
      supabaseAdmin
        .from('cloned_voices')
        .select('id, name, elevenlabs_voice_id, created_at')
        .eq('user_id', req.userId)
        .order('created_at', { ascending: false }),
    ])

    if (error) {
      logger.error({ error, userId: req.userId }, 'Failed to fetch cloned voices')
    }

    res.json({ public: publicVoices, personal: personalVoices ?? [] })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'voices.list error')
    res.status(500).json({ error: 'Failed to fetch voices', code: 'SERVICE_ERROR' })
  }
})

/**
 * POST /api/v1/voices/clone
 * Clone une voix via ElevenLabs Voice Cloning
 */
voicesRouter.post('/voices/clone', authMiddleware, async (req, res) => {
  const parsed = cloneVoiceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { name, sample_url } = parsed.data

  try {
    // Vérifier les limites selon le plan
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', req.userId)
      .single()

    if (!profile) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' })
      return
    }

    if (profile.plan === 'free') {
      res.status(403).json({
        error: 'Voice cloning requires a paid plan',
        code: 'PLAN_RESTRICTION',
      })
      return
    }

    const { count } = await supabaseAdmin
      .from('cloned_voices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)

    if (profile.plan === 'starter' && (count ?? 0) >= 2) {
      res.status(403).json({
        error: 'Starter plan allows maximum 2 cloned voices',
        code: 'VOICE_LIMIT_REACHED',
      })
      return
    }

    // Télécharger l'échantillon audio depuis Supabase Storage
    const sampleResponse = await fetch(sample_url)
    if (!sampleResponse.ok) {
      res.status(400).json({ error: 'Failed to download voice sample', code: 'DOWNLOAD_ERROR' })
      return
    }
    const audioBuffer = Buffer.from(await sampleResponse.arrayBuffer())

    // Cloner la voix via ElevenLabs
    const { voiceId: elevenlabsVoiceId } = await cloneVoice(audioBuffer, name)

    // Sauvegarder en DB
    const { data: clonedVoice, error: dbError } = await supabaseAdmin
      .from('cloned_voices')
      .insert({ user_id: req.userId, name, elevenlabs_voice_id: elevenlabsVoiceId })
      .select()
      .single()

    if (dbError) {
      logger.error({ dbError }, 'Failed to save cloned voice')
      res.status(500).json({ error: 'Failed to save voice', code: 'DB_ERROR' })
      return
    }

    logger.info({ userId: req.userId, voiceName: name }, 'Voice cloned successfully')
    res.status(201).json({ data: clonedVoice })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'voices.clone error')
    res.status(500).json({ error: 'Failed to clone voice', code: 'SERVICE_ERROR' })
  }
})

// ── GET /api/v1/voices/public (avec filtres) ──────────────────────────────

const voiceFiltersSchema = z.object({
  gender:  z.string().max(50).optional(),
  accent:  z.string().max(50).optional(),
  useCase: z.string().max(50).optional(),
  search:  z.string().max(100).optional(),
})

voicesRouter.get('/voices/public', authMiddleware, async (req, res) => {
  const parsed = voiceFiltersSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    const filters = parsed.data

    const { data: favData } = await supabaseAdmin
      .from('voice_favorites')
      .select('voice_id')
      .eq('user_id', req.userId)

    const favoriteIds = new Set((favData ?? []).map((f: { voice_id: string }) => f.voice_id))
    const voices = await listPublicVoices(filters)

    res.json({
      voices: voices.map((v) => ({ ...v, isFavorite: favoriteIds.has(v.id) })),
    })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'voices.public error')
    res.status(500).json({ error: 'Failed to fetch voices', code: 'SERVICE_ERROR' })
  }
})

// ── GET /api/v1/voices/filters ────────────────────────────────────────────

voicesRouter.get('/voices/filters', authMiddleware, async (req, res) => {
  try {
    const filters = await getVoiceFilters()
    res.json(filters)
  } catch (err) {
    logger.error({ err }, 'voices.filters error')
    res.status(500).json({ error: 'Failed to fetch filters', code: 'SERVICE_ERROR' })
  }
})

// ── POST /api/v1/voices/favorites ─────────────────────────────────────────

const favoriteSchema = z.object({
  voiceId: z.string().min(1),
  action:  z.enum(['add', 'remove']),
})

voicesRouter.post('/voices/favorites', authMiddleware, async (req, res) => {
  const parsed = favoriteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { voiceId, action } = parsed.data

  try {
    if (action === 'add') {
      await supabaseAdmin
        .from('voice_favorites')
        .upsert({ user_id: req.userId, voice_id: voiceId })
    } else {
      await supabaseAdmin
        .from('voice_favorites')
        .delete()
        .match({ user_id: req.userId, voice_id: voiceId })
    }
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'voices.favorites error')
    res.status(500).json({ error: 'Failed to update favorite', code: 'SERVICE_ERROR' })
  }
})

// ── GET /api/v1/voices/favorites ──────────────────────────────────────────

voicesRouter.get('/voices/favorites', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('voice_favorites')
      .select('voice_id')
      .eq('user_id', req.userId)

    res.json({ favoriteIds: (data ?? []).map((f: { voice_id: string }) => f.voice_id) })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'voices.favorites.get error')
    res.status(500).json({ error: 'Failed to fetch favorites', code: 'SERVICE_ERROR' })
  }
})

/**
 * DELETE /api/v1/voices/:id
 * Supprime une voix clonée
 */
voicesRouter.delete('/voices/:id', authMiddleware, async (req, res) => {
  const { id } = req.params

  try {
    const { data: existing } = await supabaseAdmin
      .from('cloned_voices')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (!existing) {
      res.status(404).json({ error: 'Voice not found', code: 'NOT_FOUND' })
      return
    }

    const { error } = await supabaseAdmin.from('cloned_voices').delete().eq('id', id)

    if (error) {
      logger.error({ error, voiceId: id }, 'Failed to delete voice')
      res.status(500).json({ error: 'Failed to delete voice', code: 'DB_ERROR' })
      return
    }

    logger.info({ voiceId: id, userId: req.userId }, 'Voice deleted')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, voiceId: id, userId: req.userId }, 'voices.delete error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

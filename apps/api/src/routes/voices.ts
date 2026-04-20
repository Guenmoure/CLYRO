import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { listPublicVoices, cloneVoice, getVoiceFilters } from '../services/elevenlabs'
import { logger } from '../lib/logger'
import { memoizeTTL } from '../lib/memoize-ttl'

export const voicesRouter = Router()

// ── ElevenLabs response caches ────────────────────────────────────────────────
// The public voice library and the filters endpoint are effectively static for
// 15-minute windows (ElevenLabs adds voices slowly, filters almost never change).
// Caching here cuts the p50 from ~1-2s to near-zero on repeat page loads.
//
// `listPublicVoices` takes an optional filters object — we key the cache on its
// JSON serialization so each filter combo is cached independently. This means
// "all French female voices" and "all English male voices" are separate cache
// entries that refresh independently.
const CACHE_TTL_VOICES_MS = 15 * 60 * 1000
const getCachedPublicVoices = memoizeTTL(
  'elevenlabs.publicVoices',
  CACHE_TTL_VOICES_MS,
  (filters: Parameters<typeof listPublicVoices>[0]) => listPublicVoices(filters),
  (filters) => JSON.stringify(filters ?? {}),
)
const getCachedVoiceFilters = memoizeTTL(
  'elevenlabs.filters',
  CACHE_TTL_VOICES_MS,
  getVoiceFilters,
)

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
      getCachedPublicVoices(undefined),
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

    // EDGE-002: reject oversized samples before touching ElevenLabs.
    // ElevenLabs caps voice-cloning samples at ~25 MB, and Supabase bucket
    // is capped at 50 MB — we enforce 25 MB here with a friendly message.
    const VOICE_SAMPLE_MAX_BYTES = 25 * 1024 * 1024
    const headRes = await fetch(sample_url, { method: 'HEAD' })
    if (headRes.ok) {
      const contentLength = Number(headRes.headers.get('content-length') ?? 0)
      if (contentLength > VOICE_SAMPLE_MAX_BYTES) {
        res.status(413).json({
          error: `Voice sample is too large (${(contentLength / 1024 / 1024).toFixed(1)} MB). Maximum is ${VOICE_SAMPLE_MAX_BYTES / 1024 / 1024} MB.`,
          code: 'PAYLOAD_TOO_LARGE',
        })
        return
      }
    }

    // Télécharger l'échantillon audio depuis Supabase Storage
    const sampleResponse = await fetch(sample_url)
    if (!sampleResponse.ok) {
      res.status(400).json({ error: 'Failed to download voice sample', code: 'DOWNLOAD_ERROR' })
      return
    }
    const audioBuffer = Buffer.from(await sampleResponse.arrayBuffer())

    // Double-check after download in case HEAD wasn't honoured by the CDN.
    if (audioBuffer.length > VOICE_SAMPLE_MAX_BYTES) {
      res.status(413).json({
        error: `Voice sample is too large (${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB). Maximum is ${VOICE_SAMPLE_MAX_BYTES / 1024 / 1024} MB.`,
        code: 'PAYLOAD_TOO_LARGE',
      })
      return
    }

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
  gender:   z.string().max(50).optional(),
  accent:   z.string().max(50).optional(),
  language: z.string().max(50).optional(),
  useCase:  z.string().max(50).optional(),
  search:   z.string().max(100).optional(),
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
    const voices = await getCachedPublicVoices(filters)

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
    const filters = await getCachedVoiceFilters()
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

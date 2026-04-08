import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { renderQueue, isRedisReady } from '../../queues/renderQueue'
import { runFacelessPipeline } from '../../pipelines/faceless'

export const pipelineFacelessRouter = Router()

const FACELESS_STYLES = [
  'cinematique',
  'stock-vo',
  // PDF canonical 4 styles
  'whiteboard',
  'stickman',
  'flat-design',
  '3d-pixar',
  // Legacy / extended styles
  'minimaliste',
  'infographie',
  'motion-graphics',
  'animation-2d',
] as const

const VIDEO_FORMATS  = ['9:16', '1:1', '16:9'] as const
const VIDEO_DURATIONS = ['15s', '30s', '60s'] as const

const createFacelessSchema = z.object({
  title:        z.string().min(1).max(200),
  style:        z.enum(FACELESS_STYLES),
  input_type:   z.enum(['script', 'audio']),
  format:       z.enum(VIDEO_FORMATS).default('16:9'),
  duration:     z.enum(VIDEO_DURATIONS).default('30s'),
  script:       z.string().min(20).max(5000).optional(),
  audio_url:    z.string().url().optional(),
  voice_id:     z.string().optional(),
  brand_kit_id: z.string().uuid().optional(),
})

const regenerateSceneSchema = z.object({
  video_id: z.string().uuid(),
  scene_id: z.string(),
  prompt_override: z.string().max(300).optional(),
})

/**
 * POST /api/v1/pipeline/faceless
 * Lance le pipeline de génération Faceless Videos
 * Retourne immédiatement { video_id } — la génération tourne en arrière-plan
 */
pipelineFacelessRouter.post('/faceless', authMiddleware, async (req, res) => {
  const parsed = createFacelessSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { title, style, input_type, format, duration, script, audio_url, voice_id, brand_kit_id } = parsed.data

  if (input_type === 'script' && !script) {
    res.status(400).json({ error: 'Script is required when input_type is script', code: 'VALIDATION_ERROR' })
    return
  }

  if (input_type === 'audio' && !audio_url) {
    res.status(400).json({ error: 'audio_url is required when input_type is audio', code: 'VALIDATION_ERROR' })
    return
  }

  try {
    // Vérifier les crédits de l'utilisateur
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits, plan')
      .eq('id', req.userId)
      .single()

    if (!profile) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' })
      return
    }

    if (profile.plan !== 'studio' && profile.credits <= 0) {
      res.status(403).json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
      })
      return
    }

    // Charger le brand kit si fourni
    let brandKit: { primary_color: string; secondary_color: string | null; font_family: string | null; logo_url: string | null; name: string } | null = null
    if (brand_kit_id) {
      const { data: kit } = await supabaseAdmin
        .from('brand_kits')
        .select('primary_color, secondary_color, font_family, logo_url, name')
        .eq('id', brand_kit_id)
        .eq('user_id', req.userId)
        .single()
      brandKit = kit ?? null
    }

    // Créer l'entrée vidéo en DB (status: pending)
    const { data: video, error: dbError } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id: req.userId,
        module: 'faceless',
        style,
        title,
        status: 'pending',
        metadata: { voice_id, input_type, format, duration, brand_kit_id: brand_kit_id ?? null },
      })
      .select()
      .single()

    if (dbError || !video) {
      logger.error({ dbError }, 'Failed to create video entry')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    const jobData = {
      type: 'faceless' as const,
      videoId:   video.id,
      userId:    req.userId,
      userEmail: req.userEmail,
      title,
      style,
      format,
      duration,
      script:   script ?? '',
      voiceId:  voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
      brandKit: brandKit ?? undefined,
    }

    // Enqueue si Redis est dispo, sinon exécution inline directe
    if (renderQueue && isRedisReady()) {
      await renderQueue.add('faceless', jobData).catch((err) => {
        logger.warn({ err, videoId: video.id }, 'Queue add failed, falling back to inline execution')
        runFacelessPipeline(jobData).catch((e) => logger.error({ e, videoId: video.id }, 'Faceless pipeline failed'))
      })
    } else {
      logger.info({ videoId: video.id }, 'Redis not ready — running pipeline inline')
      runFacelessPipeline(jobData).catch((err) => logger.error({ err, videoId: video.id }, 'Faceless pipeline failed'))
    }

    // Décrémenter les crédits après enqueue réussi (sauf plan studio)
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', req.userId)
    }

    // Retourner immédiatement
    res.status(202).json({ video_id: video.id, status: 'pending' })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'pipeline.faceless error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/pipeline/faceless/scene
 * Régénère une scène individuelle
 */
pipelineFacelessRouter.post('/faceless/scene', authMiddleware, async (req, res) => {
  const parsed = regenerateSceneSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { video_id, scene_id, prompt_override } = parsed.data

  try {
    // Vérifier que la vidéo appartient à l'utilisateur
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('metadata, style')
      .eq('id', video_id)
      .eq('user_id', req.userId)
      .single()

    if (!video) {
      res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
      return
    }

    const metadata = video.metadata as {
      scenes?: Array<{ id: string; description_visuelle: string }>
    }
    const scene = metadata.scenes?.find((s) => s.id === scene_id)

    if (!scene) {
      res.status(404).json({ error: 'Scene not found', code: 'NOT_FOUND' })
      return
    }

    const prompt = prompt_override ?? scene.description_visuelle
    const { imageUrl, promptUsed } = await import('../../services/fal').then((m) =>
      m.generateSceneImage(prompt, video.style)
    )

    // Mettre à jour le metadata de la scène
    const updatedScenes = metadata.scenes?.map((s) =>
      s.id === scene_id ? { ...s, image_url: imageUrl, description_visuelle: prompt } : s
    )

    await supabaseAdmin
      .from('videos')
      .update({ metadata: { ...metadata, scenes: updatedScenes } })
      .eq('id', video_id)

    logger.info({ videoId: video_id, sceneId: scene_id }, 'Scene regenerated')
    res.json({ data: { scene_id, image_url: imageUrl, prompt_used: promptUsed } })
  } catch (err) {
    logger.error({ err, videoId: video_id }, 'pipeline.faceless.scene error')
    res.status(500).json({ error: 'Failed to regenerate scene', code: 'SERVICE_ERROR' })
  }
})


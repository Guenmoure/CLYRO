import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { renderQueue, isRedisReady } from '../../queues/renderQueue'
import { runMotionPipeline } from '../../pipelines/motion'

export const pipelineMotionRouter = Router()

const MOTION_STYLES  = ['corporate', 'dynamique', 'luxe', 'fun'] as const
const VIDEO_FORMATS  = ['9:16', '1:1', '16:9'] as const
const VIDEO_DURATIONS = ['6s', '15s', '30s', '60s'] as const

const createMotionSchema = z.object({
  title:    z.string().min(1).max(200),
  brief:    z.string().min(20).max(2000),
  format:   z.enum(VIDEO_FORMATS),
  duration: z.enum(VIDEO_DURATIONS),
  style:    z.enum(MOTION_STYLES),
  brand_config: z.object({
    logo_url:        z.string().url().optional(),
    primary_color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
    secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    font_family:     z.string().optional(),
  }),
  voice_id: z.string().optional(),
})

/**
 * POST /api/v1/pipeline/motion
 * Lance le pipeline Motion Graphics
 * Retourne immédiatement { video_id } — génération en arrière-plan
 */
pipelineMotionRouter.post('/motion', authMiddleware, async (req, res) => {
  const parsed = createMotionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { title, brief, format, duration, style, brand_config, voice_id } = parsed.data

  try {
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
      res.status(403).json({ error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' })
      return
    }

    const { data: video, error: dbError } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id:  req.userId,
        module:   'motion',
        style,
        title,
        status:   'pending',
        metadata: { brief, format, duration, brand_config, voice_id, progress: 0 },
      })
      .select()
      .single()

    if (dbError || !video) {
      logger.error({ dbError }, 'Failed to create motion video entry')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    const jobData = {
      type: 'motion' as const,
      videoId:     video.id,
      userId:      req.userId,
      userEmail:   req.userEmail,
      title,
      brief,
      style,
      format,
      duration,
      brandConfig: brand_config,
      voiceId:     voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
    }

    // Enqueue si Redis est dispo, sinon exécution inline directe
    if (renderQueue && isRedisReady()) {
      await renderQueue.add('motion', jobData).catch((err) => {
        logger.warn({ err, videoId: video.id }, 'Queue add failed, falling back to inline execution')
        runMotionPipeline(jobData).catch((e) => logger.error({ e, videoId: video.id }, 'Motion pipeline failed'))
      })
    } else {
      logger.info({ videoId: video.id }, 'Redis not ready — running pipeline inline')
      runMotionPipeline(jobData).catch((err) => logger.error({ err, videoId: video.id }, 'Motion pipeline failed'))
    }

    // Décrémenter les crédits après enqueue réussi (sauf plan studio)
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', req.userId)
    }

    res.status(202).json({ video_id: video.id, status: 'pending' })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'pipeline.motion error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/pipeline/motion/scene
 * Régénère une scène Motion individuelle
 */
pipelineMotionRouter.post('/motion/scene', authMiddleware, async (req, res) => {
  const schema = z.object({
    video_id:        z.string().uuid(),
    scene_id:        z.string(),
    prompt_override: z.string().max(300).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { video_id, scene_id, prompt_override } = parsed.data

  try {
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

    const metadata = video.metadata as { scenes?: Array<{ id: string; description_visuelle: string }> }
    const scene    = metadata.scenes?.find((s) => s.id === scene_id)

    if (!scene) {
      res.status(404).json({ error: 'Scene not found', code: 'NOT_FOUND' })
      return
    }

    const prompt = prompt_override ?? scene.description_visuelle
    const { imageUrl, promptUsed } = await import('../../services/fal').then((m) =>
      m.generateSceneImage(prompt, video.style)
    )

    const updatedScenes = metadata.scenes?.map((s) =>
      s.id === scene_id ? { ...s, image_url: imageUrl, description_visuelle: prompt } : s
    )

    await supabaseAdmin
      .from('videos')
      .update({ metadata: { ...metadata, scenes: updatedScenes } })
      .eq('id', video_id)

    res.json({ data: { scene_id, image_url: imageUrl, prompt_used: promptUsed } })
  } catch (err) {
    logger.error({ err, videoId: video_id }, 'pipeline.motion.scene error')
    res.status(500).json({ error: 'Failed to regenerate scene', code: 'SERVICE_ERROR' })
  }
})


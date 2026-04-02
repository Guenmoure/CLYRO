import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { generateStoryboard } from '../../services/claude'
import { generateSceneImages } from '../../services/fal'
import { generateVoiceoverScenes } from '../../services/elevenlabs'
import { renderMotionVideo } from '../../services/remotion'
import { sendVideoReadyEmail } from '../../services/resend'
import { logger } from '../../lib/logger'

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

    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', req.userId)
    }

    res.status(202).json({ video_id: video.id, status: 'pending' })

    runMotionPipeline({
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
    }).catch((err) => logger.error({ err, videoId: video.id }, 'Motion pipeline failed'))
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

// ── Pipeline background job ────────────────────────────────────────────────

interface MotionPipelineParams {
  videoId:     string
  userId:      string
  userEmail:   string
  title:       string
  brief:       string
  style:       string
  format:      string
  duration:    string
  brandConfig: { primary_color: string; secondary_color?: string; font_family?: string; logo_url?: string }
  voiceId:     string
}

async function runMotionPipeline(params: MotionPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, brief, style, voiceId } = params

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'Motion pipeline status update')
  }

  try {
    // ÉTAPE 1 : Analyse du brief + génération storyboard (Claude AI)
    await updateStatus('storyboard', 10)
    const storyboard = await generateStoryboard(brief, style, params.duration as '6s' | '15s' | '30s' | '60s')

    await updateStatus('storyboard', 20, { scenes: storyboard.scenes })
    logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Motion storyboard generated')

    // ÉTAPE 2 : Génération visuels avec couleurs de marque injectées dans les prompts
    await updateStatus('visuals', 25)
    const brandedScenes = storyboard.scenes.map((scene) => ({
      ...scene,
      description_visuelle: `${scene.description_visuelle}, brand color ${params.brandConfig.primary_color}, ${style} style`,
    }))

    const sceneImages = await generateSceneImages(brandedScenes, style)

    const scenesWithImages = storyboard.scenes.map((scene) => ({
      ...scene,
      image_url: sceneImages.find((img) => img.sceneId === scene.id)?.imageUrl,
    }))

    await updateStatus('visuals', 55, { scenes: scenesWithImages })
    logger.info({ videoId, imageCount: sceneImages.length }, 'Motion scene images generated')

    // ÉTAPE 3 : Voix off (ElevenLabs)
    await updateStatus('audio', 60)
    let combinedAudioBuffer: Buffer | null = null

    if (voiceId && storyboard.scenes.some((s) => s.texte_voix?.trim())) {
      const audioResults = await generateVoiceoverScenes(storyboard.scenes, voiceId)
      if (audioResults.length > 0) {
        combinedAudioBuffer = Buffer.concat(audioResults.map((r) => r.audioBuffer))
      }
    }

    await updateStatus('audio', 72)

    // ÉTAPE 4 : Rendu Remotion (Motion Graphics + brand overlays)
    await updateStatus('assembly', 75)
    const mp4Buffer = await renderMotionVideo({
      scenes:          scenesWithImages,
      brandConfig:     { ...params.brandConfig, style: params.style },
      format:          params.format as '9:16' | '1:1' | '16:9',
      duration:        params.duration,
      voiceoverBuffer: combinedAudioBuffer,
    })

    // ÉTAPE 5 : Upload vers Supabase Storage
    await updateStatus('assembly', 88)
    const storagePath = `${userId}/${videoId}/output.mp4`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('videos')
      .upload(storagePath, mp4Buffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data: signedUrl } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7) // 7 jours

    const outputUrl = signedUrl?.signedUrl ?? ''

    await supabaseAdmin
      .from('videos')
      .update({ status: 'done', output_url: outputUrl, metadata: { progress: 100, scenes: scenesWithImages } })
      .eq('id', videoId)

    logger.info({ videoId, outputUrl }, 'Motion pipeline completed')

    await sendVideoReadyEmail(userEmail, title, outputUrl).catch((err) =>
      logger.warn({ err }, 'Failed to send video ready email')
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error({ err, videoId }, 'Motion pipeline error')

    await supabaseAdmin
      .from('videos')
      .update({ status: 'error', metadata: { error_message: errorMessage, progress: 0 } })
      .eq('id', videoId)
      .then(() => null, () => null)

    await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).then(() => null, () => null)
  }
}

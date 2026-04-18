import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { quotaMiddleware, deductCredit } from '../../middleware/quota'
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { renderQueue, isRedisReady } from '../../queues/renderQueue'
import { runMotionPipeline } from '../../pipelines/motion'
import { getMusicTrackUrl } from '../../lib/music'
import { uploadFalUrlToStorage } from '../../services/fal'
import { generateVoiceoverWithTimestamps } from '../../services/elevenlabs'

export const pipelineMotionRouter = Router()

const MOTION_STYLES  = ['corporate', 'dynamique', 'luxe', 'fun'] as const
const VIDEO_FORMATS  = ['9:16', '1:1', '16:9'] as const
const VIDEO_DURATIONS = ['6s', '15s', '30s', '60s', '90s', '120s', '180s', '300s', 'auto'] as const

const createMotionSchema = z.object({
  title:    z.string().min(1).max(200),
  brief:    z.string().min(20).max(2000),
  // Optional voiceover script — when provided + duration='auto', the backend
  // scales the scene count to preserve the full script.
  script:   z.string().max(20_000).optional(),
  format:   z.enum(VIDEO_FORMATS),
  duration: z.enum(VIDEO_DURATIONS),
  style:    z.enum(MOTION_STYLES),
  brand_config: z.object({
    logo_url:        z.string().url().optional(),
    primary_color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
    secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    font_family:     z.string().optional(),
  }),
  voice_id:       z.string().optional(),
  music_track_id: z.string().optional(),
})

/**
 * POST /api/v1/pipeline/motion
 * Lance le pipeline Motion Graphics
 * Retourne immédiatement { video_id } — génération en arrière-plan
 */
pipelineMotionRouter.post('/motion', authMiddleware, quotaMiddleware, async (req, res) => {
  const parsed = createMotionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { title, brief, script, format, duration, style, brand_config, voice_id, music_track_id } = parsed.data

  try {
    const profile = req.userProfile!

    const { data: video, error: dbError } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id:  req.userId,
        module:   'motion',
        style,
        title,
        status:   'pending',
        metadata: { brief, script, format, duration, brand_config, voice_id, progress: 0 },
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
      videoId:       video.id,
      userId:        req.userId,
      userEmail:     req.userEmail,
      title,
      brief,
      script,
      style,
      format,
      duration,
      brandConfig:   { ...brand_config, style },
      voiceId:       voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
      musicTrackUrl: music_track_id ? getMusicTrackUrl(music_track_id) : undefined,
    }

    // Enqueue si Redis est dispo ET qu'un worker consomme la queue, sinon inline
    let enqueued = false
    if (renderQueue && isRedisReady()) {
      try {
        const workers = await renderQueue.getWorkers()
        if (workers.length > 0) {
          await renderQueue.add('motion', jobData)
          enqueued = true
          logger.info({ videoId: video.id, workerCount: workers.length }, 'Job enqueued to BullMQ')
        } else {
          logger.info({ videoId: video.id }, 'No active workers — running pipeline inline')
        }
      } catch (err) {
        logger.warn({ err, videoId: video.id }, 'Queue check/add failed, falling back to inline')
      }
    }
    if (!enqueued) {
      runMotionPipeline(jobData).catch(async (err) => {
        logger.error({ err, videoId: video.id }, 'Motion pipeline failed')
        try {
          await supabaseAdmin
            .from('videos')
            .update({
              status: 'error',
              metadata: {
                error_message: err instanceof Error ? err.message : String(err),
                error_at: new Date().toISOString(),
              },
            })
            .eq('id', video.id)
        } catch (dbErr) {
          logger.error({ dbErr, videoId: video.id }, 'Failed to update motion video error status')
        }
      })
    }

    // Décrémenter les crédits après enqueue réussi (sauf plan studio)
    await deductCredit(req.userId, profile)

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
    const { imageUrl: falUrl, promptUsed } = await import('../../services/fal').then((m) =>
      m.generateSceneImage(prompt, video.style)
    )

    // Upload to Supabase Storage with fallback to fal.ai CDN URL if upload fails
    const storagePath = `${req.userId}/${video_id}/scenes/scene-${scene_id}.jpg`
    const imageUrl = await uploadFalUrlToStorage(falUrl, storagePath, 'videos')

    const updatedScenes = metadata.scenes?.map((s) =>
      s.id === scene_id ? { ...s, image_url: imageUrl, description_visuelle: prompt } : s
    )

    await supabaseAdmin
      .from('videos')
      .update({ metadata: { ...metadata, scenes: updatedScenes } })
      .eq('id', video_id)

    logger.info({ videoId: video_id, sceneId: scene_id }, 'Scene regenerated and persisted to storage')
    res.json({ data: { scene_id, image_url: imageUrl, prompt_used: promptUsed } })
  } catch (err) {
    logger.error({ err, videoId: video_id }, 'pipeline.motion.scene error')
    res.status(500).json({ error: 'Failed to regenerate scene', code: 'SERVICE_ERROR' })
  }
})

/**
 * POST /api/v1/pipeline/motion/audio-scene
 * Régénère l'audio d'une scène Motion individuelle
 * Retourne le nouvel audio URL + word timestamps + duration recalculée
 */
pipelineMotionRouter.post('/motion/audio-scene', authMiddleware, async (req, res) => {
  const schema = z.object({
    video_id: z.string().uuid(),
    scene_id: z.string(),
    text:     z.string().min(1).max(2000),
    voice_id: z.string().optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { video_id, scene_id, text, voice_id } = parsed.data

  try {
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('metadata')
      .eq('id', video_id)
      .eq('user_id', req.userId)
      .single()

    if (!video) {
      res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
      return
    }

    const metadata = video.metadata as {
      voice_id?: string
      scenes?: Array<{ id: string; texte_voix: string; duree_estimee: number; [k: string]: any }>
    }
    const scene = metadata.scenes?.find((s) => s.id === scene_id)
    if (!scene) {
      res.status(404).json({ error: 'Scene not found', code: 'NOT_FOUND' })
      return
    }

    const effectiveVoiceId = voice_id ?? metadata.voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? ''
    if (!effectiveVoiceId) {
      res.status(400).json({ error: 'No voice_id available', code: 'VALIDATION_ERROR' })
      return
    }

    // Génère le nouvel audio avec timestamps
    const result = await generateVoiceoverWithTimestamps(text, effectiveVoiceId)

    // Calcul de la durée audio réelle
    const audioDuration = result.words.length > 0
      ? result.words[result.words.length - 1].end
      : 0

    // Recalcul durée scène avec +10% buffer
    const newDuration = audioDuration > 0
      ? Math.max(Math.ceil((audioDuration * 1.1) * 10) / 10, scene.duree_estimee)
      : scene.duree_estimee

    // Persist audio + timestamps to Supabase
    const base = `${req.userId}/${video_id}/audio/scene-${scene_id}`
    const [audioUpload, tsUpload] = await Promise.all([
      supabaseAdmin.storage
        .from('videos')
        .upload(`${base}.mp3`, result.audioBuffer, { contentType: 'audio/mpeg', upsert: true }),
      supabaseAdmin.storage
        .from('videos')
        .upload(`${base}.json`, Buffer.from(JSON.stringify(result.words)), { contentType: 'application/json', upsert: true }),
    ])

    if (audioUpload.error) {
      logger.warn({ error: audioUpload.error }, 'Audio upload failed')
    }

    // Get signed URL for the audio
    const { data: signedAudio } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(`${base}.mp3`, 60 * 60 * 24 * 365)

    // Update scene in metadata
    const updatedScenes = metadata.scenes?.map((s) =>
      s.id === scene_id
        ? { ...s, texte_voix: text, duree_estimee: newDuration, audio_url: signedAudio?.signedUrl }
        : s
    )

    await supabaseAdmin
      .from('videos')
      .update({ metadata: { ...metadata, scenes: updatedScenes } })
      .eq('id', video_id)

    logger.info({ videoId: video_id, sceneId: scene_id, audioDuration, newDuration }, 'Scene audio regenerated')

    res.json({
      data: {
        scene_id,
        audio_url: signedAudio?.signedUrl,
        audio_duration: audioDuration,
        duration_frames: newDuration,
        words: result.words,
      },
    })
  } catch (err) {
    logger.error({ err, videoId: video_id }, 'pipeline.motion.audio-scene error')
    res.status(500).json({ error: 'Failed to regenerate audio', code: 'SERVICE_ERROR' })
  }
})


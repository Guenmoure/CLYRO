import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { quotaMiddleware } from '../../middleware/quota'
import { deductCredits, refundCredits, creditCostForVideo, InsufficientCreditsError } from '../../services/credits'
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { renderQueue, isRedisReady } from '../../queues/renderQueue'
import { runMotionAuto } from '../../pipelines/motion-router'
import { runMotionDesignPipeline } from '../../pipelines/motion-design'
import { getMusicTrackUrl } from '../../lib/music'
import { uploadFalUrlToStorage } from '../../services/fal'
import { generateVoiceoverWithTimestamps } from '../../services/elevenlabs'

// Motion uses Remotion (no Kling) for animation, so we charge the
// "fast" tier rate. This avoids overcharging users for video work
// that doesn't actually pay the Kling-Pro premium.
const MOTION_DEFAULT_MODE = 'fast' as const

function parseDurationToSeconds(duration: string): number {
  if (duration === 'auto') return 60
  const m = duration.match(/^(\d+)s$/)
  return m ? Number(m[1]) : 30
}

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
  /** Optional Brand Kit id. Passé tel quel à l'aiguilleur (motion_auto) puis
   *  au pipeline délégué : si présent, le pipeline lit le DNA enrichi du kit
   *  (tagline, valeurs, ton, esthétique) et l'injecte dans le prompt Claude.
   *  Cf. POMELLI_BRAND_KIT_PLAN.md §1 — c'est ce qui rend la vidéo on-brand. */
  brand_kit_id:   z.string().uuid().optional(),
  /**
   * When the user finishes a draft, the wizard sends this id so the
   * existing `videos` row (status='draft') is promoted in place to
   * status='generating' instead of inserting a fresh sibling row. This
   * eliminates the "every completed video has a zombie draft next to
   * it" bug. Optional — if absent we fall back to INSERT (legacy path
   * for any caller that doesn't pre-create a draft).
   */
  draft_id:       z.string().uuid().optional(),
})

/**
 * POST /api/v1/pipeline/motion
 * Point d'entrée UNIFIÉ du produit Motion.
 * La route ne décide PAS quel moteur utiliser : elle enfile un job
 * `motion_auto`. Le worker (pipelines/motion-router.ts) classifie le brief
 * via Claude — "graphics" (images IA + DynamicComposition) ou "design"
 * (scènes codées + MotionComposition) — puis délègue au bon pipeline.
 * Retourne immédiatement { video_id } — génération en arrière-plan.
 */
pipelineMotionRouter.post('/motion', authMiddleware, quotaMiddleware, async (req, res) => {
  const parsed = createMotionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { title, brief, script, format, duration, style, brand_config, voice_id, music_track_id, draft_id, brand_kit_id } = parsed.data

  try {
    // userProfile is set by quotaMiddleware (currently unused beyond the
    // pre-flight balance check; per-video cost is computed below).
    void req.userProfile

    // ── Promote-in-place OR insert ────────────────────────────────────
    // Previously this always INSERTed a new row, which left the wizard's
    // draft row alive as a zombie sibling of the final video. Now: if the
    // wizard hands us its draft_id, we verify ownership + draft status,
    // then UPDATE that same row to status='generating'. The id stays stable
    // through the entire draft → pending → processing → done lifecycle,
    // so there's only ever ONE row per video. If no draft_id is sent (or
    // it's stale / not a draft / not owned by req.userId), we fall back
    // to INSERT — same behaviour as before, no regression for legacy
    // callers.
    const baseMetadata = { brief, script, format, duration, brand_config, voice_id, progress: 0 }
    let video: { id: string } | null = null
    let dbError: { message?: string } | null = null

    if (draft_id) {
      const { data: draftRow } = await supabaseAdmin
        .from('videos')
        .select('id, status, user_id')
        .eq('id', draft_id)
        .eq('user_id', req.userId)
        .maybeSingle()
      if (draftRow && draftRow.status === 'draft') {
        const upd = await supabaseAdmin
          .from('videos')
          .update({
            module:   'motion',
            style,
            title,
            status: 'generating',
            metadata: baseMetadata,
            wizard_step: null,
            wizard_state: null,
          })
          .eq('id', draft_id)
          .eq('user_id', req.userId)
          .select('id')
          .single()
        video = upd.data
        dbError = upd.error
        if (video) {
          logger.info({ videoId: video.id, mode: 'promote-draft' }, 'Motion video row promoted from draft')
        }
      } else {
        logger.info(
          { draft_id, status: draftRow?.status, ownerMatch: !!draftRow },
          'Motion start: draft_id provided but row missing / not a draft / wrong owner — falling back to INSERT',
        )
      }
    }

    if (!video) {
      const ins = await supabaseAdmin
        .from('videos')
        .insert({
          user_id:  req.userId,
          module:   'motion',
          style,
          title,
          status: 'generating',
          metadata: baseMetadata,
        })
        .select('id')
        .single()
      video = ins.data
      dbError = ins.error
    }

    if (dbError || !video) {
      logger.error({ dbError }, 'Failed to create motion video entry')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    const durationSeconds = parseDurationToSeconds(duration)
    const creditCost = creditCostForVideo(durationSeconds, MOTION_DEFAULT_MODE)

    // Atomic deduction BEFORE the enqueue — a job must never start running
    // for a user whose balance can't cover it.
    try {
      await deductCredits(req.userId, creditCost, `video:${video.id}`, {
        mode: MOTION_DEFAULT_MODE,
        duration,
        durationSeconds,
        kind: 'motion',
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        await supabaseAdmin.from('videos').update({
          status: 'error',
          metadata: { error_message: 'Insufficient credits', error_at: new Date().toISOString() },
        }).eq('id', video.id).then(() => null, () => null)
        res.status(402).json({
          error: 'Insufficient credits',
          code:  'INSUFFICIENT_CREDITS',
          required: err.required,
          available: err.available,
          video_id: video.id,
        })
        return
      }
      throw err
    }

    const jobData = {
      type: 'motion_auto' as const,
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
      creditCost,
      brandKitId:    brand_kit_id,
    }

    // Enqueue si Redis est dispo ET qu'un worker consomme la queue.
    // Sans worker dispo :
    //   - ALLOW_INLINE_FALLBACK=true  → exécution inline (legacy, bloque l'event loop)
    //   - ALLOW_INLINE_FALLBACK=false → fail-fast 503 pour protéger /health (prod)
    const allowInlineFallback = process.env.ALLOW_INLINE_FALLBACK === 'true'
    let enqueued = false
    if (renderQueue && isRedisReady()) {
      try {
        // jobId = videoId so /videos/:id/cancel can renderQueue.remove(videoId)
        // while the job waits. BullMQ keeps the same id across retry attempts.
        // Clear any stale finished job with this id first (relaunch after
        // revert-to-draft reuses the same row id — add() would be a no-op).
        await renderQueue.remove(video.id).catch(() => null)
        await renderQueue.add('motion_auto', jobData, { jobId: video.id })
        enqueued = true
        logger.info({ videoId: video.id }, 'Motion auto job enqueued to BullMQ')
      } catch (err) {
        logger.warn({ err, videoId: video.id }, 'Queue add failed')
      }
    } else {
      logger.warn({ videoId: video.id }, 'Redis/BullMQ not available for motion pipeline')
    }

    if (!enqueued) {
      if (!allowInlineFallback) {
        logger.error(
          { videoId: video.id },
          'No BullMQ worker available and ALLOW_INLINE_FALLBACK=false — refusing job to protect event loop',
        )
        // Credits were deducted before the enqueue attempt — refund, the job
        // will never run.
        await refundCredits(req.userId, creditCost, `video:${video.id}`, { reason: 'worker_unavailable' })
          .catch((refundErr) => logger.error({ refundErr, videoId: video.id }, 'Refund after enqueue failure failed'))
        try {
          await supabaseAdmin
            .from('videos')
            .update({
              status: 'error',
              metadata: {
                error_message: 'Video processing worker is currently unavailable',
                error_code: 'WORKER_UNAVAILABLE',
                error_at: new Date().toISOString(),
              },
            })
            .eq('id', video.id)
        } catch (dbErr) {
          logger.error({ dbErr, videoId: video.id }, 'Failed to mark motion video as error after worker-unavailable')
        }
        res.status(503).json({
          error: 'Video processing worker is currently unavailable. Please try again shortly.',
          code: 'WORKER_UNAVAILABLE',
          video_id: video.id,
        })
        return
      }

      logger.warn(
        { videoId: video.id },
        'Falling back to inline motion pipeline (ALLOW_INLINE_FALLBACK=true) — this will block the event loop',
      )
      runMotionAuto(jobData).catch(async (err) => {
        logger.error({ err, videoId: video.id }, 'Motion auto pipeline failed')
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

    res.status(202).json({ video_id: video.id, status: 'generating', credits_deducted: creditCost })
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
        .upload(`${base}.mp3`, result.audioBuffer, { contentType: 'application/octet-stream', upsert: true }),
      supabaseAdmin.storage
        .from('videos')
        .upload(`${base}.json`, Buffer.from(JSON.stringify(result.words)), { contentType: 'application/octet-stream', upsert: true }),
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

// ── F2 Motion Design ─────────────────────────────────────────────────────────

const MOTION_DESIGN_FORMATS   = ['16_9', '9_16', '1_1'] as const
const MOTION_DESIGN_DURATIONS = ['6s', '15s', '30s', '60s', '90s', '120s', '180s', '300s', 'auto'] as const

const createMotionDesignSchema = z.object({
  title:    z.string().min(1).max(200),
  brief:    z.string().min(20).max(3000),
  format:   z.enum(MOTION_DESIGN_FORMATS),
  duration: z.enum(MOTION_DESIGN_DURATIONS),
  brand_config: z.object({
    logo_url:        z.string().url().optional(),
    primary_color:   z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
    secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  }),
  voice_id:  z.string().optional(),
  music_url: z.string().url().optional(),
  /** Optional Brand Kit id — pipeline lit le DNA et enrichit les prompts. */
  brand_kit_id: z.string().uuid().optional(),
  /** Optional draft id to promote in place — see /motion route for full rationale. */
  draft_id:  z.string().uuid().optional(),
})

/**
 * POST /api/v1/pipeline/motion/design
 * Lance le pipeline F2 Motion Design (MotionComposition)
 * Retourne immédiatement { video_id } — génération en arrière-plan
 */
pipelineMotionRouter.post('/motion/design', authMiddleware, quotaMiddleware, async (req, res) => {
  const parsed = createMotionDesignSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { title, brief, format, duration, brand_config, voice_id, music_url, draft_id, brand_kit_id } = parsed.data

  try {
    // userProfile is set by quotaMiddleware (currently unused beyond the
    // pre-flight balance check; per-video cost is computed below).
    void req.userProfile

    // Promote-in-place when the wizard sends its draft_id; otherwise INSERT.
    // See the /motion handler above for the full rationale (eliminates the
    // zombie-draft-next-to-every-video bug).
    const baseMetadata = { brief, format, duration, brand_config, voice_id, progress: 0 }
    let video: { id: string } | null = null
    let dbError: { message?: string } | null = null

    if (draft_id) {
      const { data: draftRow } = await supabaseAdmin
        .from('videos')
        .select('id, status, user_id')
        .eq('id', draft_id)
        .eq('user_id', req.userId)
        .maybeSingle()
      if (draftRow && draftRow.status === 'draft') {
        const upd = await supabaseAdmin
          .from('videos')
          .update({
            module:   'motion_design',
            style:    'motion_design',
            title,
            status: 'generating',
            metadata: baseMetadata,
            wizard_step: null,
            wizard_state: null,
          })
          .eq('id', draft_id)
          .eq('user_id', req.userId)
          .select('id')
          .single()
        video = upd.data
        dbError = upd.error
        if (video) {
          logger.info({ videoId: video.id, mode: 'promote-draft' }, 'MotionDesign video row promoted from draft')
        }
      }
    }

    if (!video) {
      const ins = await supabaseAdmin
        .from('videos')
        .insert({
          user_id:  req.userId,
          module:   'motion_design',
          style:    'motion_design',
          title,
          status: 'generating',
          metadata: baseMetadata,
        })
        .select('id')
        .single()
      video = ins.data
      dbError = ins.error
    }

    if (dbError || !video) {
      logger.error({ dbError }, 'Failed to create motion design video entry')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    const durationSeconds = parseDurationToSeconds(duration)
    const creditCost = creditCostForVideo(durationSeconds, MOTION_DEFAULT_MODE)

    // Atomic deduction BEFORE the enqueue — see /motion above.
    try {
      await deductCredits(req.userId, creditCost, `video:${video.id}`, {
        mode: MOTION_DEFAULT_MODE,
        duration,
        durationSeconds,
        kind: 'motion_design',
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        await supabaseAdmin.from('videos').update({
          status: 'error',
          metadata: { error_message: 'Insufficient credits', error_at: new Date().toISOString() },
        }).eq('id', video.id).then(() => null, () => null)
        res.status(402).json({
          error: 'Insufficient credits',
          code:  'INSUFFICIENT_CREDITS',
          required: err.required,
          available: err.available,
          video_id: video.id,
        })
        return
      }
      throw err
    }

    const jobData = {
      type: 'motion_design' as const,
      videoId:    video.id,
      userId:     req.userId,
      userEmail:  req.userEmail,
      title,
      brief,
      format,
      duration,
      brandConfig: brand_config,
      voiceId:    voice_id,
      musicUrl:   music_url,
      creditCost,
      brandKitId: brand_kit_id,
    }

    const allowInlineFallback = process.env.ALLOW_INLINE_FALLBACK === 'true'
    let enqueued = false

    if (renderQueue && isRedisReady()) {
      try {
        // jobId = videoId — see /motion above (cancel support + stale-id cleanup).
        await renderQueue.remove(video.id).catch(() => null)
        await renderQueue.add('motion_design', jobData, { jobId: video.id })
        enqueued = true
        logger.info({ videoId: video.id }, 'MotionDesign job enqueued to BullMQ')
      } catch (err) {
        logger.warn({ err, videoId: video.id }, 'MotionDesign queue add failed')
      }
    }

    if (!enqueued) {
      if (!allowInlineFallback) {
        // Credits were deducted before the enqueue attempt — refund, the job
        // will never run.
        await refundCredits(req.userId, creditCost, `video:${video.id}`, { reason: 'worker_unavailable' })
          .catch((refundErr) => logger.error({ refundErr, videoId: video.id }, 'Refund after enqueue failure failed'))
        await supabaseAdmin
          .from('videos')
          .update({ status: 'error', metadata: { error_message: 'Video processing worker is currently unavailable', error_at: new Date().toISOString() } })
          .eq('id', video.id)
        res.status(503).json({ error: 'Video processing worker is currently unavailable. Please try again shortly.', code: 'WORKER_UNAVAILABLE', video_id: video.id })
        return
      }

      logger.warn({ videoId: video.id }, 'MotionDesign: falling back to inline pipeline')
      runMotionDesignPipeline(jobData).catch(async (err) => {
        logger.error({ err, videoId: video.id }, 'MotionDesign pipeline inline failed')
        await supabaseAdmin
          .from('videos')
          .update({ status: 'error', metadata: { error_message: err instanceof Error ? err.message : String(err), error_at: new Date().toISOString() } })
          .eq('id', video.id)
          .then(() => null, () => null)
      })
    }

    res.status(202).json({ video_id: video.id, status: 'generating', credits_deducted: creditCost })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'pipeline.motion.design error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

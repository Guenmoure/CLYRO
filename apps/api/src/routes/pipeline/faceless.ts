import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { quotaMiddleware } from '../../middleware/quota'
import { deductCredits, refundCredits, creditCostForVideo, InsufficientCreditsError } from '../../services/credits'
import type { AnimationMode } from '@clyro/shared'

/**
 * Convert a "15s"/"30s"/.../"auto" duration string to a number of
 * seconds for credit-cost computation. 'auto' falls back to 60s since
 * we don't yet know the script's natural length at deduction time —
 * the pipeline computes the real duration later, and we settle the
 * difference via refund/extra-deduct if it diverges significantly.
 */
function parseDurationToSeconds(duration: string): number {
  if (duration === 'auto') return 60
  const m = duration.match(/^(\d+)s$/)
  return m ? Number(m[1]) : 30
}
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { renderQueue, isRedisReady } from '../../queues/renderQueue'
import { runFacelessPipeline } from '../../pipelines/faceless'
import { getMusicTrackUrl } from '../../lib/music'
import { checkScriptWpm, condenseScript } from '../../services/claude'
import { uploadFalUrlToStorage, generateSceneVideoAuto, generateSceneVideoHailuoStandard } from '../../services/fal'
import { assembleVideoFromVideoClips } from '../../services/ffmpeg'
import { writeFile, unlink, rm } from 'fs/promises'
import { createReadStream } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

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
const VIDEO_DURATIONS = ['15s', '30s', '60s', '120s', '180s', '300s', 'auto'] as const

const preGeneratedSceneSchema = z.object({
  id:               z.string(),
  script_text:      z.string().optional(),
  image_url:        z.string().url().optional(),
  clip_url:         z.string().url().optional(),
  image_prompt:     z.string().optional(),
  animation_prompt: z.string().optional(),
  // Texte optionnel à incruster (drawtext) sur l'image pendant le Ken Burns.
  // Limité à 200 caractères pour rester lisible à l'écran.
  overlay_text:     z.string().max(200).optional(),
})

const createFacelessSchema = z.object({
  title:        z.string().min(1).max(200),
  style:        z.enum(FACELESS_STYLES),
  input_type:   z.enum(['script', 'audio']),
  format:       z.enum(VIDEO_FORMATS).default('16:9'),
  duration:     z.enum(VIDEO_DURATIONS).default('30s'),
  // No max(): scripts are intentionally unlimited at the application layer.
  // The Express JSON body limit (10 MB, see apps/api/src/index.ts) is the
  // only practical cap, and that's a payload protection not a content rule.
  script:       z.string().optional(),
  audio_url:    z.string().url().optional(),
  voice_id:       z.string().optional(),
  brand_kit_id:   z.string().uuid().optional(),
  music_track_id: z.string().optional(),
  pre_generated_scenes: z.array(preGeneratedSceneSchema).optional(),
  dialogue_mode: z.boolean().optional(),
  speaker_voices: z.record(z.string()).optional(),
  animation_mode: z.enum(['storyboard', 'fast', 'pro']).optional(),
  animation_overrides: z.record(z.string(), z.enum(['storyboard', 'fast', 'pro'])).optional(),
  // F1-012: optional background music preset selected in the wizard
  music_preset: z.enum(['none', 'soft', 'upbeat', 'cinematic', 'corporate']).optional(),
  // F1-013: whether to burn word-level subtitles into the final render.
  // Defaults to FALSE — users explicitly opt in via the wizard's toggle.
  subtitles_enabled: z.boolean().optional().default(false),
  /**
   * Optional draft id — when the wizard sends it, the existing `videos`
   * row (status='draft') is promoted in place to status='generating' instead
   * of inserting a fresh sibling row. Eliminates the "every completed
   * video has a zombie draft next to it" bug.
   */
  draft_id:     z.string().uuid().optional(),
})

const regenerateSceneSchema = z.object({
  video_id: z.string().uuid(),
  scene_id: z.string(),
  prompt_override: z.string().max(300).optional(),
})

const regenerateClipSchema = z.object({
  video_id: z.string().uuid(),
  scene_id: z.string(),
  image_url: z.string().url(),
  animation_prompt: z.string().max(500).optional(),
  duration: z.enum(['5', '10']).default('5'),
})

const reassembleVideoSchema = z.object({
  video_id: z.string().uuid(),
})

/**
 * POST /api/v1/pipeline/faceless
 * Lance le pipeline de génération Faceless Videos
 * Retourne immédiatement { video_id } — la génération tourne en arrière-plan
 */
pipelineFacelessRouter.post('/faceless', authMiddleware, quotaMiddleware, async (req, res) => {
  const parsed = createFacelessSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { title, style, input_type, format, duration, script, audio_url, voice_id, brand_kit_id, music_track_id, pre_generated_scenes, dialogue_mode, speaker_voices, animation_mode, animation_overrides, music_preset, subtitles_enabled, draft_id } = parsed.data

  const hasPreGeneratedScenes = pre_generated_scenes && pre_generated_scenes.length > 0
  if (input_type === 'script' && !script && !hasPreGeneratedScenes) {
    res.status(400).json({ error: 'Script is required when input_type is script', code: 'VALIDATION_ERROR' })
    return
  }

  if (input_type === 'audio' && !audio_url) {
    res.status(400).json({ error: 'audio_url is required when input_type is audio', code: 'VALIDATION_ERROR' })
    return
  }

  // Script utilisé tel quel — pas de limite de durée ni de condensation
  const effectiveScript = script ?? ''
  const wpmMeta: { condensed?: boolean } = {}

  try {
    // userProfile is set by quotaMiddleware (currently unused beyond the
    // pre-flight balance check; per-video cost is computed below).
    void req.userProfile

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
    //
    // Note: animation_mode / animation_overrides sont écrits à la fois sur
    // les colonnes dédiées (ajoutées par la migration
    // 20260415000003_f1_animation_mode.sql) ET dans metadata JSONB.
    //   - Les colonnes permettent de filtrer/agréger facilement en SQL
    //     (dashboards internes, stats produit, indexation).
    //   - La copie dans metadata sert de filet de sécurité et reste le
    //     format consommé par le pipeline.
    const resolvedAnimationMode = animation_mode ?? 'storyboard'
    const resolvedAnimationOverrides = animation_overrides ?? {}
    const baseMetadata = {
      voice_id,
      input_type,
      format,
      duration,
      brand_kit_id: brand_kit_id ?? null,
      animation_mode: resolvedAnimationMode,
      animation_overrides: resolvedAnimationOverrides,
      music_preset: music_preset ?? 'none',
      subtitles_enabled: !!subtitles_enabled,
      // Store script for draft recovery on pipeline failure (max 50KB)
      script_draft: input_type === 'script' && script
        ? script.substring(0, 50_000)
        : undefined,
    }
    const baseRow = {
      module: 'faceless' as const,
      style,
      title,
      status: 'generating' as const,
      animation_mode: resolvedAnimationMode,
      animation_overrides: resolvedAnimationOverrides,
      metadata: baseMetadata,
    }

    // Promote-in-place when the wizard sends its draft_id; otherwise INSERT.
    // See apps/web/hooks/use-draft-save.ts and the /motion handler for the
    // full rationale — eliminates the zombie-draft-next-to-every-video bug.
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
            ...baseRow,
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
          logger.info({ videoId: video.id, mode: 'promote-draft' }, 'Faceless video row promoted from draft')
        }
      }
    }

    if (!video) {
      const ins = await supabaseAdmin
        .from('videos')
        .insert({ user_id: req.userId, ...baseRow })
        .select('id')
        .single()
      video = ins.data
      dbError = ins.error
    }

    if (dbError || !video) {
      logger.error({ dbError }, 'Failed to create video entry')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    // Cost in credits for this generation, computed from duration + animation mode.
    // Stored on jobData so the pipeline knows what to refund on error / timeout.
    const durationSeconds = parseDurationToSeconds(duration)
    const creditCost = creditCostForVideo(durationSeconds, resolvedAnimationMode as AnimationMode)

    const jobData = {
      type: 'faceless' as const,
      videoId:   video.id,
      userId:    req.userId,
      userEmail: req.userEmail,
      title,
      style,
      format,
      duration,
      script:   effectiveScript,
      voiceId:        voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
      brandKit:       brandKit ?? undefined,
      musicTrackUrl:  music_track_id ? getMusicTrackUrl(music_track_id) : undefined,
      preGeneratedScenes: pre_generated_scenes ?? undefined,
      dialogueMode:   dialogue_mode,
      speakerVoices:  speaker_voices,
      animationMode:  animation_mode,
      musicPreset:    music_preset ?? 'none',
      subtitlesEnabled: !!subtitles_enabled,
      creditCost,
    }

    // Enqueue si Redis est dispo ET qu'un worker consomme la queue.
    // IMPORTANT : isRedisReady() seul ne suffit pas — si aucun worker ne tourne,
    // les jobs s'accumulent en queue sans jamais être exécutés.
    //
    // Sans worker dispo :
    //   - ALLOW_INLINE_FALLBACK=true  → exécution inline (legacy, bloque l'event loop)
    //   - ALLOW_INLINE_FALLBACK=false → fail-fast 503 pour protéger /health (prod)
    const allowInlineFallback = process.env.ALLOW_INLINE_FALLBACK === 'true'
    let enqueued = false
    if (renderQueue && isRedisReady()) {
      try {
        await renderQueue.add('faceless', jobData)
        enqueued = true
        logger.info({ videoId: video.id }, 'Job enqueued to BullMQ')
      } catch (err) {
        logger.warn({ err, videoId: video.id }, 'Queue add failed')
      }
    } else {
      logger.warn({ videoId: video.id }, 'Redis/BullMQ not available for faceless pipeline')
    }

    if (!enqueued) {
      if (!allowInlineFallback) {
        logger.error(
          { videoId: video.id },
          'No BullMQ worker available and ALLOW_INLINE_FALLBACK=false — refusing job to protect event loop',
        )
        // Marquer la vidéo en erreur pour que le frontend sache que le job est mort à la naissance
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
          logger.error({ dbErr, videoId: video.id }, 'Failed to mark video as error after worker-unavailable')
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
        'Falling back to inline pipeline (ALLOW_INLINE_FALLBACK=true) — this will block the event loop',
      )
      runFacelessPipeline(jobData).catch(async (err) => {
        logger.error({ err, videoId: video.id }, 'Faceless pipeline failed')
        // Persister le statut erreur dans Supabase pour que le frontend puisse l'afficher
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
          logger.info({ videoId: video.id }, 'Video status updated to error in DB')
        } catch (dbErr) {
          logger.error({ dbErr, videoId: video.id }, 'Failed to update video error status in DB')
        }
      })
    }

    // Atomically deduct creditCost (computed above when building jobData).
    // After enqueue but before returning so concurrent requests can't
    // oversubscribe a tight balance.
    try {
      await deductCredits(req.userId, creditCost, `video:${video.id}`, {
        mode: resolvedAnimationMode,
        duration,
        durationSeconds,
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        // Mark the just-created row as error so the user's library reflects reality.
        await supabaseAdmin.from('videos').update({
          status: 'error',
          metadata: { error_message: 'Insufficient credits', error_at: new Date().toISOString() },
        }).eq('id', video.id).then(() => null, () => null)
        res.status(402).json({
          error:    'Insufficient credits',
          code:     'INSUFFICIENT_CREDITS',
          required: err.required,
          available: err.available,
          video_id: video.id,
        })
        return
      }
      throw err
    }

    // Retourner immédiatement (avec le coût débité pour information UI)
    res.status(202).json({
      video_id: video.id,
      status: 'generating',
      credits_deducted: creditCost,
      ...(wpmMeta.condensed !== undefined && { script_condensed: wpmMeta }),
    })
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
    const { imageUrl: falUrl, promptUsed } = await import('../../services/fal').then((m) =>
      m.generateSceneImage(prompt, video.style)
    )

    // Upload to Supabase Storage (upsert=true — regeneration replaces the existing file)
    const storagePath = `${req.userId}/${video_id}/scenes/scene-${scene_id}.jpg`
    const imageUrl = await uploadFalUrlToStorage(falUrl, storagePath, 'videos', true)

    // Mettre à jour le metadata de la scène
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
    logger.error({ err, videoId: video_id }, 'pipeline.faceless.scene error')
    res.status(500).json({ error: 'Failed to regenerate scene', code: 'SERVICE_ERROR' })
  }
})

/**
 * POST /api/v1/pipeline/faceless/clip
 * Régénère un clip vidéo pour une scène spécifique
 * Body: { video_id, scene_id, image_url, animation_prompt?, duration? }
 * Retourne: { scene_id, clip_url }
 */
pipelineFacelessRouter.post('/faceless/clip', authMiddleware, async (req, res) => {
  const parsed = regenerateClipSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { video_id, scene_id, image_url, animation_prompt, duration } = parsed.data

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

    // Générer le clip vidéo avec Kling
    const { videoUrl: falVideoUrl, model } = await generateSceneVideoAuto(
      image_url,
      animation_prompt ?? 'smooth cinematic camera movement, natural motion',
      duration as '5' | '10',
      video.style
    )

    // Uploader vers Supabase Storage (upsert=true — regeneration replaces the existing clip)
    const storagePath = `${req.userId}/${video_id}/clips/scene-${scene_id}.mp4`
    const clipUrl = await uploadFalUrlToStorage(falVideoUrl, storagePath, 'videos', true)

    // Mettre à jour le metadata de la scène avec le nouveau clip_url
    const metadata = video.metadata as {
      scenes?: Array<{ id: string; clip_url?: string; [key: string]: unknown }>
    }
    const updatedScenes = metadata.scenes?.map((s) =>
      s.id === scene_id ? { ...s, clip_url: clipUrl } : s
    )

    await supabaseAdmin
      .from('videos')
      .update({ metadata: { ...metadata, scenes: updatedScenes } })
      .eq('id', video_id)

    logger.info({ videoId: video_id, sceneId: scene_id, model }, 'Clip regenerated and persisted')
    res.json({ scene_id, clip_url: clipUrl, model })
  } catch (err) {
    logger.error({ err, videoId: video_id, sceneId: scene_id }, 'pipeline.faceless.clip error')
    res.status(500).json({ error: 'Failed to regenerate clip', code: 'SERVICE_ERROR' })
  }
})

/**
 * POST /api/v1/pipeline/faceless/reassemble
 *
 * Lance le réassemblage de la vidéo finale en arrière-plan et répond
 * IMMÉDIATEMENT en 202. Le travail lourd (FFmpeg concat, upload Supabase
 * d'un Buffer 10–50 MB, signed URL retry) ne tient plus la requête HTTP
 * ouverte → l'event loop reste libre → /health ne timeout plus pendant
 * un assemblage.
 *
 * Le frontend s'appuie sur `useVideoStatus` (Supabase realtime + SSE)
 * pour détecter le passage `assembly` → `done` (avec output_url) ou
 * `error` (avec metadata.error_message).
 *
 * Body: { video_id }
 * Retourne: { status: 'assembly', video_id }      // 202 Accepted
 *           { error: ..., code: ... }              // 4xx si validation
 */
pipelineFacelessRouter.post('/faceless/reassemble', authMiddleware, async (req, res) => {
  const parsed = reassembleVideoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { video_id } = parsed.data

  // ─── Validations rapides (synchrones côté event loop) ──────────────────
  // Tout ce qui peut justifier un 4xx doit être fait AVANT de répondre 202.
  const { data: video } = await supabaseAdmin
    .from('videos')
    .select('metadata, user_id')
    .eq('id', video_id)
    .eq('user_id', req.userId)
    .single()

  if (!video) {
    res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
    return
  }

  const metadata = video.metadata as {
    scenes?: Array<{ id: string; clip_url?: string }>
    storage_path?: string
  }

  const sceneVideoUrls = (metadata.scenes ?? [])
    .filter((s) => s.clip_url)
    .map((s) => ({ sceneId: s.id, videoUrl: s.clip_url! }))

  if (sceneVideoUrls.length === 0) {
    res.status(400).json({ error: 'No clips found to reassemble', code: 'VALIDATION_ERROR' })
    return
  }

  // ─── Marque la vidéo en cours d'assemblage avant de répondre ──────────
  // Le frontend voit immédiatement le bon état via Supabase realtime.
  await supabaseAdmin
    .from('videos')
    .update({ status: 'assembly' })
    .eq('id', video_id)

  // ─── Réponse immédiate (202 Accepted) ─────────────────────────────────
  res.status(202).json({ status: 'assembly', video_id })

  // ─── Travail lourd en arrière-plan (fire-and-forget) ──────────────────
  // Pas d'await ici : la requête HTTP est déjà fermée. Toute erreur est
  // capturée et persistée en DB pour que le frontend l'affiche.
  void runReassembleInBackground({
    videoId: video_id,
    userId: req.userId!,
    metadata,
    sceneVideoUrls,
  })
})

interface ReassembleBackgroundArgs {
  videoId: string
  userId: string
  metadata: { scenes?: Array<{ id: string; clip_url?: string }>; storage_path?: string }
  sceneVideoUrls: Array<{ sceneId: string; videoUrl: string }>
}

/**
 * Exécute l'assemblage de la vidéo finale en dehors du cycle requête/réponse.
 * Met à jour `videos.status` (`done` ou `error`) + `videos.output_url` à la fin.
 * Toute exception est rattrapée — pas d'unhandledRejection qui crasherait le
 * process Node.
 */
async function runReassembleInBackground(args: ReassembleBackgroundArgs): Promise<void> {
  const { videoId, userId, metadata, sceneVideoUrls } = args

  try {
    // Récupérer l'audio voiceover si disponible
    let voiceoverBuffer: Buffer | null = null
    try {
      const { data: audioData } = await supabaseAdmin.storage
        .from('videos')
        .download(`${userId}/${videoId}/voiceover.mp3`)
      if (audioData) {
        voiceoverBuffer = Buffer.from(await audioData.arrayBuffer())
      }
    } catch {
      logger.warn({ videoId }, 'No voiceover audio found, reassembling without audio')
    }

    // Récupérer le SRT karaoke si disponible
    let karaokeSubsContent: string | undefined
    try {
      const { data: subData } = await supabaseAdmin.storage
        .from('videos')
        .download(`${userId}/${videoId}/timestamps.json`)
      if (subData) {
        const words = JSON.parse(new TextDecoder().decode(await subData.arrayBuffer()))
        karaokeSubsContent = generateKaraokeFromWords([{ words, audioOffset: 0 }])
      }
    } catch {
      logger.warn({ videoId }, 'No timestamps found, reassembling without karaoke')
    }

    // Réassembler la vidéo (FFmpeg concat — child process)
    const { filePath: mp4FilePath, workDir: assembleWorkDir } = await assembleVideoFromVideoClips({
      sceneVideoUrls,
      voiceoverBuffer,
      backgroundMusicPath: undefined,
      karaokeSubsContent,
    })

    // Uploader la vidéo finale via stream (pas de Buffer en RAM)
    const storagePath = metadata.storage_path ?? `${userId}/${videoId}/output.mp4`
    const fileStream = createReadStream(mp4FilePath)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('videos')
      .upload(storagePath, fileStream as any, { contentType: 'video/mp4', upsert: true, duplex: 'half' } as any)

    // Cleanup assemble workDir
    await rm(assembleWorkDir, { recursive: true, force: true }).catch(() => null)

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    // Créer une signed URL avec retry
    let outputUrl = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: signedUrl, error: signError } = await supabaseAdmin.storage
        .from('videos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
      if (signedUrl?.signedUrl) {
        outputUrl = signedUrl.signedUrl
        break
      }
      logger.warn({ attempt, signError, videoId }, 'reassemble: createSignedUrl failed, retrying…')
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }

    if (!outputUrl) {
      throw new Error('Failed to create signed URL after 3 attempts')
    }

    // Mettre à jour le statut de la vidéo → propage automatiquement au front
    // via Supabase realtime channel (`useVideoStatus`).
    await supabaseAdmin
      .from('videos')
      .update({ status: 'done', output_url: outputUrl })
      .eq('id', videoId)

    logger.info({ videoId, clipCount: sceneVideoUrls.length }, 'Video reassembled successfully')
  } catch (err) {
    logger.error({ err, videoId }, 'pipeline.faceless.reassemble background error')
    // Persister l'erreur dans Supabase pour que le frontend l'affiche
    await supabaseAdmin
      .from('videos')
      .update({
        status: 'error',
        metadata: {
          ...(metadata as Record<string, unknown>),
          error_message: err instanceof Error ? err.message : String(err),
          error_at: new Date().toISOString(),
        },
      })
      .eq('id', videoId)
      .then(() => null, () => null)
  }
}

const animateSchema = z.object({
  projectId: z.string().uuid(),
  scenes: z.array(z.object({
    sceneId:          z.string(),
    mode:             z.enum(['storyboard', 'fast', 'pro']),
    imageUrl:         z.string().url(),
    animationPrompt:  z.string().max(500).optional(),
  })),
})

/**
 * POST /api/v1/pipeline/faceless/animate
 * Génère des clips vidéo pour chaque scène selon le mode d'animation choisi.
 * - storyboard → pas de GPU (Ken Burns géré côté Remotion)
 * - fast       → fal-ai/minimax/hailuo-2.3/standard/image-to-video (5-10s)
 * - pro        → fal-ai/kling-video/v3/pro/image-to-video (5-10s)
 */
pipelineFacelessRouter.post('/faceless/animate', authMiddleware, async (req, res) => {
  const parsed = animateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { projectId, scenes } = parsed.data

  // Vérifier que la vidéo appartient à l'utilisateur
  const { data: video } = await supabaseAdmin
    .from('videos')
    .select('metadata, style, user_id')
    .eq('id', projectId)
    .eq('user_id', req.userId)
    .single()

  if (!video) {
    res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' })
    return
  }

  const results: Array<{ sceneId: string; clipUrl: string | null; mode: string; skipped?: boolean }> = []

  for (const scene of scenes) {
    const { sceneId, mode, imageUrl, animationPrompt } = scene
    const prompt = animationPrompt ?? 'smooth cinematic camera movement, natural motion'

    if (mode === 'storyboard') {
      // Ken Burns is applied in Remotion — no GPU needed
      results.push({ sceneId, clipUrl: null, mode, skipped: true })
      continue
    }

    try {
      let videoUrl: string
      const storagePath = `${req.userId}/${projectId}/clips/scene-${sceneId}.mp4`

      if (mode === 'fast') {
        const r = await generateSceneVideoHailuoStandard(imageUrl, prompt)
        videoUrl = r.videoUrl
      } else {
        // pro → Kling v3 Pro (motion-fluidity SOTA on fal.ai in 2026)
        const r = await generateSceneVideoAuto(imageUrl, prompt, '5', 'cinematique')
        videoUrl = r.videoUrl
      }

      const clipUrl = await uploadFalUrlToStorage(videoUrl, storagePath, 'videos', true)

      // Mettre à jour le metadata de la scène
      const metadata = video.metadata as { scenes?: Array<{ id: string; clip_url?: string; [key: string]: unknown }> }
      const updatedScenes = (metadata.scenes ?? []).map((s) =>
        s.id === sceneId ? { ...s, clip_url: clipUrl, animation_mode: mode } : s
      )
      await supabaseAdmin
        .from('videos')
        .update({ metadata: { ...metadata, scenes: updatedScenes } })
        .eq('id', projectId)

      results.push({ sceneId, clipUrl, mode })
      logger.info({ projectId, sceneId, mode }, 'animate: clip generated')
    } catch (err) {
      logger.error({ err, projectId, sceneId, mode }, 'animate: clip generation failed')
      results.push({ sceneId, clipUrl: null, mode })
    }
  }

  res.json({ results })
})

/**
 * Helper: génère du contenu SRT karaoke depuis les words (timestamps)
 */
function generateKaraokeFromWords(sceneWordData: Array<{ words: Array<{ start: number; end: number; word: string }>; audioOffset: number }>): string {
  let srtIndex = 1
  const lines: string[] = []

  for (const { words, audioOffset } of sceneWordData) {
    for (const word of words) {
      const startMs = Math.floor((word.start + audioOffset) * 1000)
      const endMs = Math.floor((word.end + audioOffset) * 1000)
      const startTime = formatSrtTime(startMs)
      const endTime = formatSrtTime(endMs)
      lines.push(`${srtIndex++}`)
      lines.push(`${startTime} --> ${endTime}`)
      lines.push(word.word)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function formatSrtTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}


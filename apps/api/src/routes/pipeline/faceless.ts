import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { quotaMiddleware, deductCredit } from '../../middleware/quota'
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { renderQueue, isRedisReady } from '../../queues/renderQueue'
import { runFacelessPipeline } from '../../pipelines/faceless'
import { getMusicTrackUrl } from '../../lib/music'
import { checkScriptWpm, condenseScript } from '../../services/claude'
import { uploadFalUrlToStorage, generateSceneVideoAuto } from '../../services/fal'
import { assembleVideoFromVideoClips } from '../../services/ffmpeg'
import { writeFile, unlink } from 'fs/promises'
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
})

const createFacelessSchema = z.object({
  title:        z.string().min(1).max(200),
  style:        z.enum(FACELESS_STYLES),
  input_type:   z.enum(['script', 'audio']),
  format:       z.enum(VIDEO_FORMATS).default('16:9'),
  duration:     z.enum(VIDEO_DURATIONS).default('30s'),
  script:       z.string().min(1).max(100000).optional(),
  audio_url:    z.string().url().optional(),
  voice_id:       z.string().optional(),
  brand_kit_id:   z.string().uuid().optional(),
  music_track_id: z.string().optional(),
  pre_generated_scenes: z.array(preGeneratedSceneSchema).optional(),
  dialogue_mode: z.boolean().optional(),
  speaker_voices: z.record(z.string()).optional(),
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

  const { title, style, input_type, format, duration, script, audio_url, voice_id, brand_kit_id, music_track_id, pre_generated_scenes, dialogue_mode, speaker_voices } = parsed.data

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
    const profile = req.userProfile!

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
      script:   effectiveScript,
      voiceId:        voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
      brandKit:       brandKit ?? undefined,
      musicTrackUrl:  music_track_id ? getMusicTrackUrl(music_track_id) : undefined,
      preGeneratedScenes: pre_generated_scenes ?? undefined,
      dialogueMode:   dialogue_mode,
      speakerVoices:  speaker_voices,
    }

    // Enqueue si Redis est dispo ET qu'un worker consomme la queue, sinon inline
    // IMPORTANT : isRedisReady() seul ne suffit pas — si aucun worker ne tourne,
    // les jobs s'accumulent en queue sans jamais être exécutés.
    let enqueued = false
    if (renderQueue && isRedisReady()) {
      try {
        const workers = await renderQueue.getWorkers()
        if (workers.length > 0) {
          await renderQueue.add('faceless', jobData)
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

    // Décrémenter les crédits après enqueue réussi (sauf plan studio)
    await deductCredit(req.userId, profile)

    // Retourner immédiatement
    res.status(202).json({
      video_id: video.id,
      status: 'pending',
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
 * Réassemble la vidéo finale en utilisant les clips existants de Supabase Storage
 * Body: { video_id }
 * Retourne: { status: 'done', output_url }
 */
pipelineFacelessRouter.post('/faceless/reassemble', authMiddleware, async (req, res) => {
  const parsed = reassembleVideoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const { video_id } = parsed.data

  try {
    // Vérifier que la vidéo appartient à l'utilisateur
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('metadata, user_id')
      .eq('id', video_id)
      .single()

    if (!video || video.user_id !== req.userId) {
      res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
      return
    }

    const metadata = video.metadata as {
      scenes?: Array<{ id: string; clip_url?: string }>
      storage_path?: string
    }

    // Récupérer les URLs des clips depuis le metadata
    const sceneVideoUrls = (metadata.scenes ?? [])
      .filter((s) => s.clip_url)
      .map((s) => ({ sceneId: s.id, videoUrl: s.clip_url! }))

    if (sceneVideoUrls.length === 0) {
      res.status(400).json({ error: 'No clips found to reassemble', code: 'VALIDATION_ERROR' })
      return
    }

    // Récupérer l'audio voiceover si disponible
    let voiceoverBuffer: Buffer | null = null
    try {
      const { data: audioData } = await supabaseAdmin.storage
        .from('videos')
        .download(`${req.userId}/${video_id}/voiceover.mp3`)
      if (audioData) {
        voiceoverBuffer = Buffer.from(await audioData.arrayBuffer())
      }
    } catch {
      logger.warn({ videoId: video_id }, 'No voiceover audio found, reassembling without audio')
    }

    // Récupérer le SRT karaoke si disponible
    let karaokeSubsContent: string | undefined
    try {
      const { data: subData } = await supabaseAdmin.storage
        .from('videos')
        .download(`${req.userId}/${video_id}/timestamps.json`)
      if (subData) {
        const words = JSON.parse(new TextDecoder().decode(await subData.arrayBuffer()))
        // Générer SRT depuis les timestamps (simplifié)
        karaokeSubsContent = generateKaraokeFromWords([{ words, audioOffset: 0 }])
      }
    } catch {
      logger.warn({ videoId: video_id }, 'No timestamps found, reassembling without karaoke')
    }

    // Réassembler la vidéo
    const mp4Buffer = await assembleVideoFromVideoClips({
      sceneVideoUrls,
      voiceoverBuffer,
      backgroundMusicPath: undefined,
      karaokeSubsContent,
    })

    // Uploader la vidéo finale
    const storagePath = metadata.storage_path ?? `${req.userId}/${video_id}/output.mp4`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('videos')
      .upload(storagePath, mp4Buffer, { contentType: 'video/mp4', upsert: true })

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
      logger.warn({ attempt, signError, videoId: video_id }, 'reassemble: createSignedUrl failed, retrying…')
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }

    if (!outputUrl) {
      throw new Error('Failed to create signed URL after 3 attempts')
    }

    // Mettre à jour le statut de la vidéo
    await supabaseAdmin
      .from('videos')
      .update({ status: 'done', output_url: outputUrl })
      .eq('id', video_id)

    logger.info({ videoId: video_id, clipCount: sceneVideoUrls.length }, 'Video reassembled successfully')
    res.json({ status: 'done', output_url: outputUrl })
  } catch (err) {
    logger.error({ err, videoId: video_id }, 'pipeline.faceless.reassemble error')
    res.status(500).json({ error: 'Failed to reassemble video', code: 'SERVICE_ERROR' })
  }
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


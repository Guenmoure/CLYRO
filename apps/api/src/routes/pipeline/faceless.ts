import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../../middleware/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { generateStoryboard } from '../../services/claude'
import { generateSceneImages } from '../../services/fal'
import { generateVoiceoverScenes } from '../../services/elevenlabs'
import { assembleVideo } from '../../services/ffmpeg'
import { sendVideoReadyEmail } from '../../services/resend'
import { logger } from '../../lib/logger'

export const pipelineFacelessRouter = Router()

const FACELESS_STYLES = [
  'animation-2d',
  'stock-vo',
  'minimaliste',
  'infographie',
  'whiteboard',
  'cinematique',
] as const

const createFacelessSchema = z.object({
  title: z.string().min(1).max(200),
  style: z.enum(FACELESS_STYLES),
  input_type: z.enum(['script', 'audio']),
  script: z.string().min(50).max(5000).optional(),
  audio_url: z.string().url().optional(),
  voice_id: z.string().optional(),
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

  const { title, style, input_type, script, audio_url, voice_id } = parsed.data

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

    // Créer l'entrée vidéo en DB (status: pending)
    const { data: video, error: dbError } = await supabaseAdmin
      .from('videos')
      .insert({
        user_id: req.userId,
        module: 'faceless',
        style,
        title,
        status: 'pending',
        metadata: { voice_id, input_type },
      })
      .select()
      .single()

    if (dbError || !video) {
      logger.error({ dbError }, 'Failed to create video entry')
      res.status(500).json({ error: 'Failed to create video', code: 'DB_ERROR' })
      return
    }

    // Décrémenter les crédits (sauf plan studio)
    if (profile.plan !== 'studio') {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: profile.credits - 1 })
        .eq('id', req.userId)
    }

    // Retourner immédiatement — la génération tourne en arrière-plan
    res.status(202).json({ video_id: video.id, status: 'pending' })

    // Lancer le pipeline en arrière-plan (non bloquant)
    runFacelessPipeline({
      videoId: video.id,
      userId: req.userId,
      userEmail: req.userEmail,
      title,
      style,
      script: script ?? '',
      voiceId: voice_id ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? '',
    }).catch((err) => {
      logger.error({ err, videoId: video.id }, 'Faceless pipeline failed')
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

// ── Pipeline background job ───────────────────────────────────────────────

interface PipelineParams {
  videoId: string
  userId: string
  userEmail: string
  title: string
  style: string
  script: string
  voiceId: string
}

async function runFacelessPipeline(params: PipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, style, script, voiceId } = params

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'Pipeline status update')
  }

  try {
    // ÉTAPE 1 : Storyboard (Claude AI)
    await updateStatus('storyboard', 10)
    const storyboard = await generateStoryboard(script, style, '30s')

    await updateStatus('storyboard', 25, { scenes: storyboard.scenes })
    logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Storyboard generated')

    // ÉTAPE 2 : Génération visuels (fal.ai)
    await updateStatus('visuals', 30)
    const sceneImages = await generateSceneImages(storyboard.scenes, style)

    // Mettre à jour les scenes avec les URLs d'images
    const scenesWithImages = storyboard.scenes.map((scene) => ({
      ...scene,
      image_url: sceneImages.find((img) => img.sceneId === scene.id)?.imageUrl,
    }))

    await updateStatus('visuals', 60, { scenes: scenesWithImages })
    logger.info({ videoId, imageCount: sceneImages.length }, 'Scene images generated')

    // ÉTAPE 3 : Voix off (ElevenLabs)
    await updateStatus('audio', 65)
    let combinedAudioBuffer: Buffer | null = null

    if (voiceId && storyboard.scenes.some((s) => s.texte_voix?.trim())) {
      const audioResults = await generateVoiceoverScenes(storyboard.scenes, voiceId)

      if (audioResults.length > 0) {
        // Combiner tous les buffers audio en séquence
        combinedAudioBuffer = Buffer.concat(audioResults.map((r) => r.audio))
      }
    }

    await updateStatus('audio', 75)
    logger.info({ videoId, hasAudio: !!combinedAudioBuffer }, 'Voiceover generated')

    // ÉTAPE 4 : Assemblage FFmpeg
    await updateStatus('assembly', 80)
    const mp4Buffer = await assembleVideo({
      scenes: scenesWithImages,
      sceneImages,
      voiceoverBuffer: combinedAudioBuffer,
    })

    // ÉTAPE 5 : Upload vers Supabase Storage
    await updateStatus('assembly', 90)
    const storagePath = `${userId}/${videoId}/output.mp4`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('videos')
      .upload(storagePath, mp4Buffer, {
        contentType: 'video/mp4',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { data: signedUrl } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7) // 7 jours

    const outputUrl = signedUrl?.signedUrl ?? ''

    // ÉTAPE 6 : Finalisation
    await supabaseAdmin
      .from('videos')
      .update({
        status: 'done',
        output_url: outputUrl,
        metadata: { progress: 100, scenes: scenesWithImages },
      })
      .eq('id', videoId)

    logger.info({ videoId, outputUrl }, 'Faceless pipeline completed')

    // Envoyer l'email de notification
    await sendVideoReadyEmail(userEmail, title, outputUrl).catch((err) => {
      logger.warn({ err }, 'Failed to send video ready email (non-blocking)')
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error({ err, videoId }, 'Faceless pipeline error')

    await supabaseAdmin
      .from('videos')
      .update({
        status: 'error',
        metadata: { error_message: errorMessage, progress: 0 },
      })
      .eq('id', videoId)
      .catch(() => null)

    // Rembourser le crédit en cas d'erreur
    await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).catch(() => null)
  }
}

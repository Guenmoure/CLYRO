import * as Sentry from '@sentry/node'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '../lib/supabase'
import { generateMotionStoryboard } from '../services/claude'
import { detectLanguage } from '../lib/detect-language'
import { refundCredits } from '../services/credits'
import { generateSceneImage, uploadFalUrlToStorage, type BrandColors } from '../services/fal'
import { generateVoiceoverScenesWithTimestamps } from '../services/elevenlabs'
import { renderMotionVideo } from '../services/remotion'
import { renderMotionVideoLambda, isLambdaEnabled } from '../services/remotionLambda'
import { sendVideoReadyEmail } from '../services/resend'
import { selectFalModel, sceneNeedsImage } from '../config/fal-models'
import { logger } from '../lib/logger'
import { assertNotCancelled, CancelledError } from './cancellation'

async function downloadMusicTrack(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download music track: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export interface MotionPipelineParams {
  videoId: string
  userId: string
  userEmail: string
  title: string
  brief: string
  /** Optional voiceover script. When provided + duration='auto', the scene
   *  count is derived from the word count to preserve the full script. */
  script?: string
  style: string
  format: string
  duration: string
  brandConfig: { primary_color: string; secondary_color?: string; font_family?: string; logo_url?: string }
  voiceId: string
  musicTrackUrl?: string
  /** Number of credits the route already deducted for this run.
   *  Used to refund the exact amount on pipeline error. */
  creditCost?: number
}

export async function runMotionPipeline(params: MotionPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, brief, script, style, voiceId, musicTrackUrl, creditCost } = params

  // Status is always 'generating' while the pipeline runs. The granular
  // phase (storyboard / visuals / audio / assembly) lives in
  // metadata.phase so the 4-value status enum stays clean.
  const updateStatus = async (phase: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status: 'generating', metadata: { phase, progress, ...extra } })
      .eq('id', videoId)
      // Never resurrect a row the user just cancelled.
      .neq('status', 'cancelled')
    logger.info({ videoId, phase, progress }, 'Motion pipeline status update')
  }

  try {
    // Coopération annulation : abandon immédiat si annulé avant le pickup.
    await assertNotCancelled(videoId)

    // ÉTAPE 1 : Storyboard (Claude AI) — génère animation_type, display_text, needs_background, cta_text
    await updateStatus('storyboard', 10)
    // Pass both brief and script so 'auto' duration mode can size the
    // storyboard from the script's true word count instead of a fixed target.
    const scriptForClaude = script && script.trim().length > 0 ? script : brief
    // Detect language from the source the user actually wrote in (script if
    // provided, otherwise the brief). Prevents Claude from defaulting to French.
    const language = detectLanguage(scriptForClaude)
    logger.info({ videoId, language: language.code }, 'Brief/script language detected')
    const storyboard = await generateMotionStoryboard(brief, style, params.format, params.duration, scriptForClaude, language)
    await updateStatus('storyboard', 20, { scenes: storyboard.scenes })
    logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Motion storyboard generated')

    // Annulé pendant le storyboard ? Stop avant de payer fal.ai/ElevenLabs.
    await assertNotCancelled(videoId)

    // ÉTAPE 2 : Visuels fal.ai — deux passes : schnell preview puis HD optimal
    await updateStatus('visuals', 25)

    const brand: BrandColors = {
      primary_color: params.brandConfig.primary_color,
      secondary_color: params.brandConfig.secondary_color,
    }

    const visualSceneList = storyboard.scenes.filter((s) => sceneNeedsImage(s.scene_type, s.needs_background))
    const textOnlyScenes = storyboard.scenes.filter((s) => !sceneNeedsImage(s.scene_type, s.needs_background))

    // Passe 1 (preview) : flux/schnell — toutes les scènes visuelles en parallèle (~3s)
    // Permet d'afficher un aperçu rapide à l'utilisateur pendant la génération HD
    const previewResults = await Promise.allSettled(
      visualSceneList.map(async (scene) => {
        const brandedPrompt = `${scene.description_visuelle}, brand color ${params.brandConfig.primary_color}, ${style} style`
        const result = await generateSceneImage(brandedPrompt, style, undefined, brand, 'fal-ai/flux/schnell')
        const storagePath = `${userId}/${videoId}/scenes/preview-${scene.id}.jpg`
        const imageUrl = await uploadFalUrlToStorage(result.imageUrl, storagePath, 'videos')
        return { sceneId: scene.id, imageUrl }
      })
    )

    const previewImageMap = new Map(
      previewResults
        .filter((r): r is PromiseFulfilledResult<{ sceneId: string; imageUrl: string }> => r.status === 'fulfilled')
        .map((r) => [r.value.sceneId, r.value.imageUrl])
    )
    // Envoyer les previews schnell au frontend — l'utilisateur voit les images rapidement
    const previewScenes = storyboard.scenes.map((s) => ({ ...s, image_url: previewImageMap.get(s.id) }))
    await updateStatus('visuals', 40, { scenes: previewScenes, preview: true })
    logger.info({ videoId, previewCount: previewImageMap.size }, 'Motion: schnell previews sent — starting HD generation')

    // Passe 2 (HD) + voiceover en parallèle
    const [sceneImages, audioResults] = await Promise.all([
      Promise.all(
        visualSceneList.map(async (scene) => {
            const { model } = selectFalModel(scene.scene_type, style)
            const brandedPrompt = `${scene.description_visuelle}, brand color ${params.brandConfig.primary_color}, ${style} style`
            const result = await generateSceneImage(brandedPrompt, style, undefined, brand, model ?? undefined)
            const storagePath = `${userId}/${videoId}/scenes/scene-${scene.id}.jpg`
            const imageUrl = await uploadFalUrlToStorage(result.imageUrl, storagePath, 'videos')
            logger.info({ sceneId: scene.id, scene_type: scene.scene_type, model }, 'Motion: scene HD image generated')
            return { sceneId: scene.id, imageUrl, promptUsed: result.promptUsed }
          })
      ),
      voiceId && storyboard.scenes.some((s) => s.texte_voix?.trim())
        ? generateVoiceoverScenesWithTimestamps(storyboard.scenes, voiceId, { userId, videoId })
        : Promise.resolve([]),
    ])

    const visualScenes = visualSceneList

    logger.info({ videoId, visualScenes: visualScenes.length, textOnlyScenes: textOnlyScenes.length, audioScenes: audioResults.length }, 'Motion visuals + voiceover generated')

    // Merge scenes: visual scenes get image_url, text-only keep no image; calibrate duree_estimee from audio
    const audioDurationMap = new Map<string, number>()
    for (const r of audioResults) {
      if (r.words.length > 0) {
        audioDurationMap.set(r.sceneId, r.words[r.words.length - 1].end)
      }
    }

    const audioOverflowWarnings: Array<{ sceneId: string; overflow: number; originalDuration: number; audioDuration: number }> = []

    const scenesWithImages = storyboard.scenes.map((scene) => {
      const imageUrl = sceneImages.find((img) => img.sceneId === scene.id)?.imageUrl
      const audioDuration = audioDurationMap.get(scene.id)

      if (audioDuration) {
        const overflow = audioDuration - scene.duree_estimee
        if (overflow > 3) {
          audioOverflowWarnings.push({
            sceneId: scene.id,
            overflow: Math.round(overflow * 10) / 10,
            originalDuration: scene.duree_estimee,
            audioDuration: Math.round(audioDuration * 10) / 10,
          })
          logger.warn(
            { videoId, sceneId: scene.id, overflow, originalDuration: scene.duree_estimee, audioDuration },
            'Motion: audio overflow >3s — scene duration will be extended automatically'
          )
        }
      }

      return {
        ...scene,
        image_url: imageUrl,
        // Calibrate duration from actual audio with +10% buffer for breathing room; keep original if no audio
        duree_estimee: audioDuration
          ? Math.max(Math.ceil((audioDuration * 1.1) * 10) / 10, scene.duree_estimee)
          : scene.duree_estimee,
      }
    })

    if (audioOverflowWarnings.length > 0) {
      logger.warn({ videoId, overflowCount: audioOverflowWarnings.length, warnings: audioOverflowWarnings }, 'Motion: audio overflow warnings detected')
    }

    const combinedAudioBuffer: Buffer | null =
      audioResults.length > 0
        ? Buffer.concat(audioResults.map((r) => r.audioBuffer))
        : null

    await updateStatus('audio', 72, {
      scenes: scenesWithImages,
      ...(audioOverflowWarnings.length > 0 && { audio_overflow_warnings: audioOverflowWarnings }),
    })

    // ÉTAPE 3 : Musique de fond (optionnelle)
    let musicBuffer: Buffer | null = null
    if (musicTrackUrl) {
      musicBuffer = await downloadMusicTrack(musicTrackUrl).catch((err) => {
        logger.warn({ err }, 'Motion: failed to download music track — continuing without')
        return null
      })
    }

    // Annulé pendant visuels + audio ? Stop avant le rendu Remotion.
    await assertNotCancelled(videoId)

    // ÉTAPE 4 : Rendu Remotion (Lambda si activé, sinon local) — single code path
    // Les deux renderers retournent { mp4: Buffer, thumbnail: Buffer | null }
    // depuis que le Lambda re-télécharge l'output S3 dans le worker. Storage
    // uniforme côté Supabase, retention contrôlée par CLYRO, URLs signées 1 an.
    await updateStatus('assembly', 75)

    const renderOptions = {
      scenes:          scenesWithImages,
      brandConfig:     { ...params.brandConfig, style: params.style },
      format:          params.format as '9:16' | '1:1' | '16:9',
      duration:        params.duration,
      voiceoverBuffer: combinedAudioBuffer,
      musicBuffer,
    }

    const useLambda = isLambdaEnabled()
    logger.info({ videoId, renderer: useLambda ? 'lambda' : 'local' }, 'Motion: starting render')

    const { mp4: mp4Buffer, thumbnail: thumbnailBuffer } = useLambda
      ? await renderMotionVideoLambda(renderOptions)
      : await renderMotionVideo(renderOptions)

    await updateStatus('assembly', 88)
    const storagePath = `${userId}/${videoId}/output.mp4`

    // Retry sur upload : un 503 transient ne doit pas jeter la pipeline
    const UPLOAD_MAX_RETRIES = 3
    let uploadError: { message: string } | null = null
    for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
      const result = await supabaseAdmin.storage
        .from('videos')
        .upload(storagePath, mp4Buffer, { contentType: 'video/mp4', upsert: true })
      uploadError = result.error
      if (!uploadError) break

      logger.warn(
        { attempt, videoId, error: uploadError.message, sizeMB: Math.round(mp4Buffer.length / 1024 / 1024) },
        'Supabase upload failed, retrying…',
      )
      if (attempt < UPLOAD_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, [5_000, 15_000, 30_000][attempt - 1] ?? 30_000))
      }
    }
    if (uploadError) throw new Error(`Storage upload failed after ${UPLOAD_MAX_RETRIES} attempts: ${uploadError.message}`)

    const { data: signedUrl } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
    const outputUrl: string = signedUrl?.signedUrl ?? ''

    // Upload thumbnail if captured (works for both Lambda and local paths now)
    let thumbnailUrl: string | undefined
    if (thumbnailBuffer) {
      const thumbPath = `${userId}/${videoId}/thumbnail.png`
      const { error: thumbErr } = await supabaseAdmin.storage
        .from('videos')
        .upload(thumbPath, thumbnailBuffer, { contentType: 'image/png', upsert: true })
      if (!thumbErr) {
        const { data: thumbSigned } = await supabaseAdmin.storage
          .from('videos')
          .createSignedUrl(thumbPath, 60 * 60 * 24 * 365)
        thumbnailUrl = thumbSigned?.signedUrl
        logger.info({ videoId, thumbnailUrl }, 'Motion: thumbnail uploaded')
      } else {
        logger.warn({ thumbErr }, 'Motion: thumbnail upload failed')
      }
    }

    await supabaseAdmin
      .from('videos')
      .update({
        status: 'done',
        output_url: outputUrl,
        metadata: {
          progress: 100,
          scenes: scenesWithImages,
          storage_path: `${params.userId}/${videoId}/output.mp4`,
          thumbnail_url: thumbnailUrl,
        },
      })
      .eq('id', videoId)

    logger.info({ videoId, outputUrl }, 'Motion pipeline completed')

    await sendVideoReadyEmail(userEmail, title, outputUrl).catch((err) =>
      logger.warn({ err }, 'Failed to send video ready email')
    )

    // Cf. faceless.ts : libère la heap avant que le worker ne pick le job suivant.
    if (typeof global.gc === 'function') {
      try {
        global.gc()
        logger.info({ videoId, heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) }, 'Post-pipeline GC triggered')
      } catch {
        // gc() may throw if --expose-gc isn't set — best effort
      }
    }
  } catch (err) {
    // Annulation utilisateur : ne PAS marquer 'error', ne PAS refund (la
    // route /cancel a déjà émis le refund idempotent). Return silencieux.
    if (err instanceof CancelledError) {
      logger.info({ videoId }, 'Motion pipeline halted — video cancelled by user')
      return
    }

    const errorMessage = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { extra: { videoId, userId } })
    logger.error({ err, videoId }, 'Motion pipeline error')

    // Preserve existing metadata (brief, brand_config, voice_id, etc.) for draft recovery.
    const { data: existingVideo } = await supabaseAdmin
      .from('videos')
      .select('metadata')
      .eq('id', videoId)
      .single()
      .then((r) => r, () => ({ data: null }))
    const existingMeta = (existingVideo?.metadata ?? {}) as Record<string, unknown>

    await supabaseAdmin
      .from('videos')
      .update({
        status: 'error',
        metadata: { ...existingMeta, error_message: errorMessage, progress: 0, error_at: new Date().toISOString() },
      })
      .eq('id', videoId)
      // Ne pas écraser 'cancelled' si l'annulation a fait échouer un appel en vol.
      .neq('status', 'cancelled')
      .then(() => null, () => null)

    if (creditCost && creditCost > 0) {
      await refundCredits(userId, creditCost, `video:${videoId}`, { reason: 'pipeline_error' })
        .catch((refErr) => logger.warn({ err: refErr, userId, videoId }, 'Motion refund failed (non-blocking)'))
    } else {
      // Legacy 1-credit fallback
      await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).then(() => null, () => null)
    }
  }
}

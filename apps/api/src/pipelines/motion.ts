import * as Sentry from '@sentry/node'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '../lib/supabase'
import { generateMotionStoryboard } from '../services/claude'
import { generateSceneImage, uploadFalUrlToStorage, type BrandColors } from '../services/fal'
import { generateVoiceoverScenesWithTimestamps } from '../services/elevenlabs'
import { renderMotionVideo } from '../services/remotion'
import { renderMotionVideoLambda, isLambdaEnabled } from '../services/remotionLambda'
import { sendVideoReadyEmail } from '../services/resend'
import { selectFalModel, sceneNeedsImage } from '../config/fal-models'
import { logger } from '../lib/logger'

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
  style: string
  format: string
  duration: string
  brandConfig: { primary_color: string; secondary_color?: string; font_family?: string; logo_url?: string }
  voiceId: string
  musicTrackUrl?: string
}

export async function runMotionPipeline(params: MotionPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, brief, style, voiceId, musicTrackUrl } = params

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'Motion pipeline status update')
  }

  try {
    // ÉTAPE 1 : Storyboard (Claude AI) — génère animation_type, display_text, needs_background, cta_text
    await updateStatus('storyboard', 10)
    const storyboard = await generateMotionStoryboard(brief, style, params.format, params.duration)
    await updateStatus('storyboard', 20, { scenes: storyboard.scenes })
    logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Motion storyboard generated')

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

    // ÉTAPE 4 : Rendu Remotion (Lambda si activé, sinon local)
    await updateStatus('assembly', 75)

    const renderOptions = {
      scenes:          scenesWithImages,
      brandConfig:     { ...params.brandConfig, style: params.style },
      format:          params.format as '9:16' | '1:1' | '16:9',
      duration:        params.duration,
      voiceoverBuffer: combinedAudioBuffer,
      musicBuffer,
    }

    let outputUrl: string

    let thumbnailUrl: string | undefined

    if (isLambdaEnabled()) {
      logger.info({ videoId }, 'Using Remotion Lambda renderer')
      outputUrl = await renderMotionVideoLambda(renderOptions)
    } else {
      logger.info({ videoId }, 'Using local Remotion renderer')
      const { mp4: mp4Buffer, thumbnail: thumbnailBuffer } = await renderMotionVideo(renderOptions)

      await updateStatus('assembly', 88)
      const storagePath = `${userId}/${videoId}/output.mp4`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('videos')
        .upload(storagePath, mp4Buffer, { contentType: 'video/mp4', upsert: true })

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

      const { data: signedUrl } = await supabaseAdmin.storage
        .from('videos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

      outputUrl = signedUrl?.signedUrl ?? ''

      // Upload thumbnail if captured
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
  } catch (err) {
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
      .then(() => null, () => null)

    await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).then(() => null, () => null)
  }
}

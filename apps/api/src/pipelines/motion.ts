import * as Sentry from '@sentry/node'
import { supabaseAdmin } from '../lib/supabase'
import { generateStoryboard } from '../services/claude'
import { generateSceneImages } from '../services/fal'
import { generateVoiceoverScenes } from '../services/elevenlabs'
import { renderMotionVideo } from '../services/remotion'
import { sendVideoReadyEmail } from '../services/resend'
import { logger } from '../lib/logger'

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
}

export async function runMotionPipeline(params: MotionPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, brief, style, voiceId } = params

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'Motion pipeline status update')
  }

  try {
    // ÉTAPE 1 : Storyboard (Claude AI)
    await updateStatus('storyboard', 10)
    const storyboard = await generateStoryboard(brief, style, params.duration as '6s' | '15s' | '30s' | '60s')
    await updateStatus('storyboard', 20, { scenes: storyboard.scenes })
    logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Motion storyboard generated')

    // ÉTAPE 2 : Visuels avec brand colors injectées dans les prompts
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

    // ÉTAPE 4 : Rendu Remotion
    await updateStatus('assembly', 75)
    const mp4Buffer = await renderMotionVideo({
      scenes:          scenesWithImages,
      brandConfig:     { ...params.brandConfig, style: params.style },
      format:          params.format as '9:16' | '1:1' | '16:9',
      duration:        params.duration,
      voiceoverBuffer: combinedAudioBuffer,
    })

    // ÉTAPE 5 : Upload Supabase Storage
    await updateStatus('assembly', 88)
    const storagePath = `${userId}/${videoId}/output.mp4`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('videos')
      .upload(storagePath, mp4Buffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data: signedUrl } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7)

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
    Sentry.captureException(err, { extra: { videoId, userId } })
    logger.error({ err, videoId }, 'Motion pipeline error')

    await supabaseAdmin
      .from('videos')
      .update({ status: 'error', metadata: { error_message: errorMessage, progress: 0 } })
      .eq('id', videoId)
      .then(() => null, () => null)

    await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).then(() => null, () => null)
  }
}

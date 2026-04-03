import * as Sentry from '@sentry/node'
import { supabaseAdmin } from '../lib/supabase'
import { generateStoryboard } from '../services/claude'
import { generateSceneImages } from '../services/fal'
import { generateVoiceoverScenes } from '../services/elevenlabs'
import { assembleVideo } from '../services/ffmpeg'
import { sendVideoReadyEmail } from '../services/resend'
import { logger } from '../lib/logger'

export interface FacelessPipelineParams {
  videoId: string
  userId: string
  userEmail: string
  title: string
  style: string
  script: string
  voiceId: string
}

export async function runFacelessPipeline(params: FacelessPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, style, script, voiceId } = params

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'Faceless pipeline status update')
  }

  try {
    // ÉTAPE 1 : Storyboard (Claude AI)
    await updateStatus('storyboard', 10)
    const storyboard = await generateStoryboard(script, style, '30s')
    await updateStatus('storyboard', 25, { scenes: storyboard.scenes })
    logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Storyboard generated')

    // ÉTAPE 2 : Visuels (fal.ai)
    await updateStatus('visuals', 30)
    const sceneImages = await generateSceneImages(storyboard.scenes, style)
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
        combinedAudioBuffer = Buffer.concat(audioResults.map((r) => r.audioBuffer))
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

    // ÉTAPE 5 : Upload Supabase Storage
    await updateStatus('assembly', 90)
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

    logger.info({ videoId, outputUrl }, 'Faceless pipeline completed')

    await sendVideoReadyEmail(userEmail, title, outputUrl).catch((err) =>
      logger.warn({ err }, 'Failed to send video ready email (non-blocking)')
    )
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { extra: { videoId, userId } })
    logger.error({ err, videoId }, 'Faceless pipeline error')

    await supabaseAdmin
      .from('videos')
      .update({ status: 'error', metadata: { error_message: errorMessage, progress: 0 } })
      .eq('id', videoId)
      .then(() => null, () => null)

    await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).then(() => null, () => null)
  }
}

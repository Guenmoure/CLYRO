import * as Sentry from '@sentry/node'
import { supabaseAdmin } from '../lib/supabase'
import { generateStoryboard } from '../services/claude'
import { generateSceneImages } from '../services/fal'
import { generateVoiceoverScenes } from '../services/elevenlabs'
import { assembleVideo } from '../services/ffmpeg'
import { sendVideoReadyEmail } from '../services/resend'
import { logger } from '../lib/logger'

export interface BrandKitRef {
  name: string
  primary_color: string
  secondary_color: string | null
  font_family: string | null
  logo_url: string | null
}

export interface FacelessPipelineParams {
  videoId: string
  userId: string
  userEmail: string
  title: string
  style: string
  format: string
  duration: string
  script: string
  voiceId: string
  brandKit?: BrandKitRef
}

export async function runFacelessPipeline(params: FacelessPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, style, script, voiceId, brandKit } = params

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
    const storyboard = await generateStoryboard(script, style, '30s', brandKit)
    await updateStatus('storyboard', 25, { scenes: storyboard.scenes })
    logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Storyboard generated')

    // ÉTAPES 2 + 3 en parallèle : Visuels (fal.ai) + Voix off (ElevenLabs)
    // Les deux sont indépendants → gain de ~15-20s sur des vidéos courtes
    await updateStatus('visuals', 30)

    const hasVoice = !!(voiceId && storyboard.scenes.some((s) => s.texte_voix?.trim()))

    const [sceneImages, audioResults] = await Promise.all([
      generateSceneImages(storyboard.scenes, style, storyboard.master_seed, brandKit ?? undefined),
      hasVoice
        ? generateVoiceoverScenes(storyboard.scenes, voiceId)
        : Promise.resolve([]),
    ])

    const scenesWithImages = storyboard.scenes.map((scene) => ({
      ...scene,
      image_url: sceneImages.find((img) => img.sceneId === scene.id)?.imageUrl,
    }))

    const combinedAudioBuffer: Buffer | null =
      audioResults.length > 0
        ? Buffer.concat(audioResults.map((r) => r.audioBuffer))
        : null

    await updateStatus('audio', 75, { scenes: scenesWithImages })
    logger.info({ videoId, imageCount: sceneImages.length, hasAudio: !!combinedAudioBuffer }, 'Visuals + voiceover generated')

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

    // Signed URL 1 an — storagePath conservé en metadata pour renouvellement futur
    const { data: signedUrl } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

    const outputUrl = signedUrl?.signedUrl ?? ''

    await supabaseAdmin
      .from('videos')
      .update({ status: 'done', output_url: outputUrl, metadata: { progress: 100, scenes: scenesWithImages, storage_path: storagePath } })
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

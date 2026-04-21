/**
 * F2 Motion Design Pipeline
 * Brief → Claude (MotionScene[]) → ElevenLabs voiceover → Remotion MotionDesign render
 */
import * as Sentry from '@sentry/node'
import { supabaseAdmin } from '../lib/supabase'
import { generateMotionDesignScenes } from '../services/claude'
import { generateVoiceoverWithTimestamps } from '../services/elevenlabs'
import { renderMotionDesignVideo } from '../services/remotion'
import { sendVideoReadyEmail } from '../services/resend'
import { logger } from '../lib/logger'

export interface MotionDesignPipelineParams {
  videoId:   string
  userId:    string
  userEmail: string
  title:     string
  brief:     string
  format:    '16_9' | '9_16' | '1_1'
  duration:  string
  brandConfig: {
    primary_color:   string
    secondary_color?: string
    logo_url?:        string
  }
  voiceId?:    string
  musicUrl?:   string
}

export async function runMotionDesignPipeline(params: MotionDesignPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, brief, format, duration, brandConfig, voiceId, musicUrl } = params

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'MotionDesign pipeline status update')
  }

  try {
    // ÉTAPE 1 — Claude génère les MotionScene[]
    await updateStatus('storyboard', 10)
    const { scenes, voiceoverScript, totalFrames } = await generateMotionDesignScenes(
      brief, format, duration, brandConfig,
    )
    await updateStatus('storyboard', 25, { scenes })
    logger.info({ videoId, sceneCount: scenes.length, totalFrames }, 'MotionDesign scenes generated')

    // ÉTAPE 2 — ElevenLabs voiceover (parallèle-possible mais court ici)
    await updateStatus('audio', 30)

    let voiceoverBuffer: Buffer | null = null
    if (voiceId && voiceoverScript.trim()) {
      try {
        const result = await generateVoiceoverWithTimestamps(voiceoverScript, voiceId)
        voiceoverBuffer = result.audioBuffer
        logger.info({ videoId, audioBytes: voiceoverBuffer.length }, 'MotionDesign voiceover generated')
      } catch (err) {
        logger.warn({ err, videoId }, 'MotionDesign: voiceover generation failed — continuing without audio')
      }
    }

    await updateStatus('audio', 50)

    // ÉTAPE 3 — Rendu Remotion MotionDesign
    await updateStatus('assembly', 55)

    const { mp4: mp4Buffer, thumbnail: thumbnailBuffer } = await renderMotionDesignVideo({
      scenes,
      format,
      voiceoverBuffer,
      musicUrl,
    })

    await updateStatus('assembly', 88)

    // ÉTAPE 4 — Upload Supabase Storage
    const storagePath = `${userId}/${videoId}/output.mp4`
    const UPLOAD_MAX_RETRIES = 3
    let uploadError: { message: string } | null = null

    for (let attempt = 1; attempt <= UPLOAD_MAX_RETRIES; attempt++) {
      const result = await supabaseAdmin.storage
        .from('videos')
        .upload(storagePath, mp4Buffer, { contentType: 'video/mp4', upsert: true })
      uploadError = result.error
      if (!uploadError) break
      logger.warn({ attempt, videoId, error: uploadError.message }, 'MotionDesign: upload retry…')
      if (attempt < UPLOAD_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, [5_000, 15_000, 30_000][attempt - 1] ?? 30_000))
      }
    }
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data: signedUrl } = await supabaseAdmin.storage
      .from('videos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365)

    const outputUrl = signedUrl?.signedUrl ?? ''

    // Thumbnail
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
      }
    }

    await supabaseAdmin
      .from('videos')
      .update({
        status:     'done',
        output_url: outputUrl,
        metadata: {
          progress:      100,
          scenes,
          storage_path:  storagePath,
          thumbnail_url: thumbnailUrl,
        },
      })
      .eq('id', videoId)

    logger.info({ videoId, outputUrl }, 'MotionDesign pipeline completed')

    await sendVideoReadyEmail(userEmail, title, outputUrl).catch((err) =>
      logger.warn({ err }, 'Failed to send video ready email')
    )

    if (typeof global.gc === 'function') {
      try { global.gc() } catch { /* best-effort */ }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { extra: { videoId, userId } })
    logger.error({ err, videoId }, 'MotionDesign pipeline error')

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

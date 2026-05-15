/**
 * F2 Motion Design Pipeline
 * Brief → Claude (MotionScene[]) → ElevenLabs voiceover → Remotion MotionDesign render
 */
import * as Sentry from '@sentry/node'
import { supabaseAdmin } from '../lib/supabase'
import { generateMotionDesignScenes } from '../services/claude'
import { detectLanguage } from '../lib/detect-language'
import { refundCredits } from '../services/credits'
import { generateVoiceoverWithTimestamps } from '../services/elevenlabs'
import { renderMotionDesignVideo } from '../services/remotion'
import { renderMotionDesignVideoLambda, isLambdaEnabled } from '../services/remotionLambda'
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
  /** Visual register from the frontend's style picker. Threaded into Claude's
   *  scene-type selection so corporate/dynamique/luxe/fun produce visibly
   *  different videos instead of one generic mix. */
  style?:    'corporate' | 'dynamique' | 'luxe' | 'fun'
  brandConfig: {
    primary_color:   string
    secondary_color?: string
    logo_url?:        string
    /** Google Font name passed through to Claude (for editorial hint)
     *  and to Remotion (loaded via @remotion/google-fonts). Optional. */
    font_family?:    string
  }
  voiceId?:    string
  musicUrl?:   string
  /** Number of credits the route already deducted; refunded on error. */
  creditCost?: number
}

export async function runMotionDesignPipeline(params: MotionDesignPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, brief, format, duration, style, brandConfig, voiceId, musicUrl, creditCost } = params

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'MotionDesign pipeline status update')
  }

  try {
    // ÉTAPE 1 — Claude génère les MotionScene[] + voiceovers[i] per scene
    await updateStatus('storyboard', 10)
    const language = detectLanguage(brief)
    logger.info({ videoId, language: language.code }, 'Brief language detected')
    const { scenes, voiceovers, voiceoverScript, totalFrames } = await generateMotionDesignScenes(
      brief, format, duration, brandConfig, language, style,
    )
    await updateStatus('storyboard', 25, { scenes })
    logger.info({ videoId, sceneCount: scenes.length, voiceoverWords: voiceoverScript.split(/\s+/).filter(Boolean).length, claudeTotalFrames: totalFrames, styleHint: style }, 'MotionDesign scenes generated')

    // ÉTAPE 2 — ElevenLabs voiceover PER SCENE en parallèle
    //
    // Old design: one big TTS call on the concatenated script. The single
    // audio track was then played from frame 0 regardless of where each
    // scene started → systematic drift. Scene 2's narration would land on
    // scene 1's visuals because Claude's duration guesses didn't match
    // ElevenLabs' actual pacing.
    //
    // New design: parallel TTS per scene. Each scene's audio length is
    // used to OVERRIDE Claude's duration hint, then the audio is attached
    // back to that exact scene via voiceoverAudioUrl (data URL). Scenes
    // without voiceover (dark_light_switch, pure visual beats) keep
    // Claude's hint.
    await updateStatus('audio', 30)

    const FPS = 30
    if (voiceId) {
      const ttsResults = await Promise.all(
        voiceovers.map(async (text, i) => {
          if (!text.trim()) return { i, audioBuffer: null as Buffer | null, audioSeconds: 0 }
          try {
            const { audioBuffer, words } = await generateVoiceoverWithTimestamps(text, voiceId)
            // Last word's end time = audio length in seconds. Fall back
            // to estimating from buffer size if alignment is missing
            // (MP3 ~128 kbps mono → bytes / 16000 ≈ seconds).
            const audioSeconds = words.length > 0
              ? words[words.length - 1]!.end
              : audioBuffer.length / 16_000
            return { i, audioBuffer, audioSeconds }
          } catch (err) {
            logger.warn({ err, sceneIdx: i, videoId }, 'MotionDesign: scene TTS failed — scene will be silent')
            return { i, audioBuffer: null as Buffer | null, audioSeconds: 0 }
          }
        }),
      )

      // Attach per-scene audio + override durations.
      let totalAudioFrames = 0
      for (const { i, audioBuffer, audioSeconds } of ttsResults) {
        const scene = scenes[i]
        if (!scene) continue
        if (audioBuffer && audioSeconds > 0) {
          // Ceil to whole frames + a 6-frame (0.2s) tail so the voice
          // doesn't get clipped by the scene boundary.
          const audioFrames = Math.ceil(audioSeconds * FPS) + 6
          scene.duration = audioFrames
          scene.voiceoverAudioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`
          totalAudioFrames += audioFrames
        }
      }
      logger.info(
        {
          videoId,
          ttsScenes: ttsResults.filter((r) => r.audioBuffer).length,
          ttsFailed: ttsResults.filter((r) => !r.audioBuffer && voiceovers[r.i]?.trim()).length,
          totalAudioFrames,
        },
        'MotionDesign: per-scene TTS done, durations re-derived from audio',
      )
    }

    await updateStatus('audio', 50)

    // ÉTAPE 3 — Rendu Remotion MotionDesign (Lambda si configuré, sinon local)
    // Les deux renderers retournent { mp4: Buffer, thumbnail: Buffer | null }
    // depuis que le Lambda re-télécharge l'output S3. Single code path pour
    // l'upload Supabase + thumbnail.
    await updateStatus('assembly', 55)

    const useLambda = isLambdaEnabled()
    logger.info({ videoId, renderer: useLambda ? 'lambda' : 'local' }, 'MotionDesign: starting render')

    // Pass scenes with per-scene voiceover already attached. The legacy
    // `voiceoverBuffer` is no longer needed — the audio lives on each
    // MotionScene via `voiceoverAudioUrl`. Brand is threaded so every
    // scene reads the live palette via React context instead of using
    // hardcoded #ff6b00 / system fonts.
    const renderArgs = {
      scenes,
      format,
      voiceoverBuffer: null,
      musicUrl,
      brand: {
        primary:    brandConfig.primary_color,
        secondary:  brandConfig.secondary_color,
        fontFamily: brandConfig.font_family
          ? `${brandConfig.font_family}, system-ui, -apple-system, sans-serif`
          : undefined,
      },
    }
    const { mp4: mp4Buffer, thumbnail: thumbnailBuffer } = useLambda
      ? await renderMotionDesignVideoLambda(renderArgs)
      : await renderMotionDesignVideo(renderArgs)

    await updateStatus('assembly', 88)

    // Upload Supabase Storage avec retry — un 503 transient ne doit pas
    // tuer la pipeline (le buffer est en RAM, on peut réessayer).
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

    // Thumbnail (works for both Lambda and local paths now)
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

    logger.info({ videoId, outputUrl, lambda: useLambda }, 'MotionDesign pipeline completed')

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

    if (creditCost && creditCost > 0) {
      await refundCredits(userId, creditCost, `video:${videoId}`, { reason: 'pipeline_error' })
        .catch((refErr) => logger.warn({ err: refErr, userId, videoId }, 'MotionDesign refund failed (non-blocking)'))
    } else {
      await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).then(() => null, () => null)
    }
  }
}

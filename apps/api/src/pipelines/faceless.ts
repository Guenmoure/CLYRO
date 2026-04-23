import * as Sentry from '@sentry/node'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '../lib/supabase'
import { generateStoryboard } from '../services/claude'
import { generateSceneImages, generateSceneVideoAuto, uploadFalUrlToStorage } from '../services/fal'
import { generateVoiceoverScenesWithTimestamps } from '../services/elevenlabs'
import { assembleVideo, assembleVideoFromVideoClips, generateKaraokeFromWords, renderKenBurnsFFmpeg } from '../services/ffmpeg'
import { sendVideoReadyEmail } from '../services/resend'
import { logger } from '../lib/logger'

// AnimationMode: user-selectable global strategy for clip generation
// - 'storyboard' → always Ken Burns (static images with smooth transitions, no GPU cost)
// - 'fast'       → Kling Standard variant (faster, cheaper)
// - 'pro'        → Kling Pro variant (highest quality, slower)
export type AnimationMode = 'storyboard' | 'fast' | 'pro'

// Styles that default to Ken Burns (Remotion CPU render) when no animation_mode is specified.
// Savings: ~$0.021/clip × 6 clips = ~$0.13/video for 60% of generations
const KENBURNS_STYLES = new Set(['minimaliste', 'infographie', 'whiteboard', 'stock-vo', 'stickman'])

async function downloadMusicTrack(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download music track: ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const tmpPath = join(tmpdir(), `clyro-music-${randomUUID()}.mp3`)
  await writeFile(tmpPath, buffer)
  return tmpPath
}

export interface BrandKitRef {
  name: string
  primary_color: string
  secondary_color: string | null
  font_family: string | null
  logo_url: string | null
}

export interface PreGeneratedScene {
  id: string
  script_text?: string
  image_url?: string
  clip_url?: string
  image_prompt?: string
  animation_prompt?: string
  /** Optional caption burned over the Ken Burns clip via ffmpeg drawtext. */
  overlay_text?: string
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
  musicTrackUrl?: string   // URL d'une piste audio de fond royalty-free (optionnel)
  preGeneratedScenes?: PreGeneratedScene[]  // Scènes déjà générées côté frontend (skip fal.ai + Kling)
  dialogueMode?: boolean   // true = auto-detect & enable multi-character voices
  speakerVoices?: Record<string, string> // map speaker name → voice_id (optional override)
  animationMode?: AnimationMode // global animation strategy; 'storyboard' bypasses Kling entirely
}

// Timeout global du pipeline : 45 min — au-delà, on considère qu'il est bloqué.
// 45 min reste sous le lockDuration BullMQ (60 min) : le watchdog déclenche
// AVANT que BullMQ ne re-queue le job, évitant les double-rendus.
const PIPELINE_TIMEOUT_MS = Number(process.env.PIPELINE_TIMEOUT_MS ?? 45 * 60 * 1000)

export async function runFacelessPipeline(params: FacelessPipelineParams): Promise<void> {
  const { videoId, userId, userEmail, title, style, duration, script, voiceId, brandKit, musicTrackUrl, preGeneratedScenes, dialogueMode, speakerVoices, animationMode } = params

  // Resolve effective animation mode: explicit override > style default > 'fast' fallback
  const effectiveAnimationMode: AnimationMode =
    animationMode ?? (KENBURNS_STYLES.has(style) ? 'storyboard' : 'fast')
  const skipAnimation = effectiveAnimationMode === 'storyboard'

  // Watchdog : si le pipeline n'a pas fini au bout de PIPELINE_TIMEOUT_MS,
  // on marque la vidéo en erreur pour débloquer le frontend
  let finished = false
  const watchdog = setTimeout(async () => {
    if (finished) return
    logger.error({ videoId, timeoutMs: PIPELINE_TIMEOUT_MS }, 'Pipeline watchdog triggered — marking video as error')
    try {
      await supabaseAdmin
        .from('videos')
        .update({
          status: 'error',
          metadata: {
            error_message: `Pipeline timeout after ${PIPELINE_TIMEOUT_MS / 1000}s — process may still be running`,
            error_at: new Date().toISOString(),
          },
        })
        .eq('id', videoId)
      await supabaseAdmin.rpc('increment_credits', { user_id: userId, amount: 1 }).then(() => null, () => null)
    } catch (dbErr) {
      logger.error({ dbErr, videoId }, 'Watchdog DB update failed')
    }
  }, PIPELINE_TIMEOUT_MS)

  const updateStatus = async (status: string, progress: number, extra?: object) => {
    await supabaseAdmin
      .from('videos')
      .update({ status, metadata: { progress, ...extra } })
      .eq('id', videoId)
    logger.info({ videoId, status, progress }, 'Faceless pipeline status update')
  }

  // Déterminer si on peut utiliser des données pré-générées du frontend
  const hasPreImages = preGeneratedScenes && preGeneratedScenes.every((s) => !!s.image_url)
  const hasPreClips  = preGeneratedScenes && preGeneratedScenes.every((s) => !!s.clip_url)

  try {
    // ÉTAPE 1 : Storyboard (Claude AI) — sauté si scènes pré-générées disponibles
    let storyboard: Awaited<ReturnType<typeof generateStoryboard>>
    if (preGeneratedScenes && preGeneratedScenes.length > 0) {
      await updateStatus('storyboard', 20)
      // Synthétiser un storyboard minimal depuis les données frontend
      storyboard = {
        master_seed: Math.floor(Math.random() * 1000000),
        total_duration: preGeneratedScenes.length * 5,
        scenes: preGeneratedScenes.map((s, i) => ({
          id: s.id,
          index: i,
          description_visuelle: s.image_prompt ?? '',
          animation_prompt: s.animation_prompt ?? 'smooth cinematic camera movement, natural motion',
          texte_voix: s.script_text ?? '',
          duree_estimee: 5,
          image_url: s.image_url,
        })),
      }
      logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Using pre-generated scenes — skipping storyboard generation')
    } else {
      await updateStatus('storyboard', 10)
      storyboard = await generateStoryboard(script, style, duration, brandKit)
      await updateStatus('storyboard', 25, { scenes: storyboard.scenes })
      logger.info({ videoId, sceneCount: storyboard.scenes.length }, 'Storyboard generated')
    }

    // ÉTAPE 1.5 : Si dialogue_mode actif, assigner les voix aux personnages
    if (dialogueMode && speakerVoices) {
      const updatedScenes = storyboard.scenes.map((scene) => {
        if (scene.speaker && speakerVoices[scene.speaker]) {
          return {
            ...scene,
            voice_id: speakerVoices[scene.speaker],
          }
        }
        return scene
      })
      storyboard.scenes = updatedScenes
      logger.info({ videoId, speakerCount: Object.keys(speakerVoices).length }, 'Speaker voices assigned to scenes')
    }

    // ÉTAPES 2 + 3 en parallèle : Visuels (fal.ai) + Voix off (ElevenLabs avec timestamps)
    await updateStatus('visuals', 30)

    const hasVoice = !!(voiceId && storyboard.scenes.some((s) => s.texte_voix?.trim()))

    // Images : utiliser celles du frontend si disponibles, sinon générer via fal.ai
    const imagePromise: Promise<Array<{ sceneId: string; imageUrl: string; promptUsed?: string }>> = hasPreImages
      ? Promise.resolve(preGeneratedScenes!.map((s) => ({ sceneId: s.id, imageUrl: s.image_url!, promptUsed: s.image_prompt })))
      : generateSceneImages(storyboard.scenes, style, storyboard.master_seed, brandKit ?? undefined, { userId, videoId })

    const [sceneImages, audioResults] = await Promise.all([
      imagePromise,
      hasVoice
        ? generateVoiceoverScenesWithTimestamps(storyboard.scenes, voiceId, { userId, videoId })
        : Promise.resolve([]),
    ])

    if (hasPreImages) {
      logger.info({ videoId, sceneCount: sceneImages.length }, 'Using pre-generated images — skipped fal.ai')
    }

    // Validate audio durations vs estimated durations (Task 2)
    const audioDurations = new Map<string, number>()
    const audioWarnings: Array<{ sceneId: string; estimatedDuration: number; actualDuration: number; overflow: string }> = []

    for (const audioResult of audioResults) {
      const actualDuration = audioResult.words.length > 0
        ? audioResult.words[audioResult.words.length - 1].end
        : 0
      audioDurations.set(audioResult.sceneId, actualDuration)

      const sceneWithText = storyboard.scenes.find((s) => s.id === audioResult.sceneId)
      if (sceneWithText && sceneWithText.duree_estimee) {
        const estimatedDuration = sceneWithText.duree_estimee
        const overflow = ((actualDuration - estimatedDuration) / estimatedDuration) * 100

        if (overflow > 20) {
          audioWarnings.push({
            sceneId: audioResult.sceneId,
            estimatedDuration,
            actualDuration,
            overflow: `+${Math.round(overflow)}%`,
          })
          logger.warn(
            { videoId, sceneId: audioResult.sceneId, estimated: estimatedDuration, actual: actualDuration, overflowPercent: overflow },
            'ElevenLabs audio exceeds estimated duration by > 20%'
          )
        }
      }
    }

    const scenesWithImages = storyboard.scenes.map((scene) => ({
      ...scene,
      image_url: sceneImages.find((img) => img.sceneId === scene.id)?.imageUrl,
      audioDuration: audioDurations.get(scene.id),
    }))

    const combinedAudioBuffer: Buffer | null =
      audioResults.length > 0
        ? Buffer.concat(audioResults.map((r) => r.audioBuffer))
        : null

    // Persist combined audio + timestamps to Supabase Storage (non-blocking)
    if (combinedAudioBuffer && audioResults.length > 0) {
      Promise.all([
        // Upload combined voiceover audio
        supabaseAdmin.storage
          .from('videos')
          .upload(`${userId}/${videoId}/voiceover.mp3`, combinedAudioBuffer, { contentType: 'application/octet-stream', upsert: true })
          .then(({ error }) => {
            if (error) {
              logger.warn({ error, videoId }, 'Failed to persist combined voiceover to storage (non-blocking)')
            } else {
              logger.info({ videoId, audioBytes: combinedAudioBuffer.length }, 'Combined voiceover persisted to storage')
            }
          }),
        // Build and upload word timestamps with cumulative audio offsets
        (async () => {
          let audioOffset = 0
          const allWords = audioResults.flatMap((r) => {
            const words = r.words.map((w) => ({
              ...w,
              start: w.start + audioOffset,
              end: w.end + audioOffset,
            }))
            const sceneDuration = r.words.length > 0 ? r.words[r.words.length - 1].end : 0
            audioOffset += sceneDuration
            return words
          })

          await supabaseAdmin.storage
            .from('videos')
            .upload(`${userId}/${videoId}/timestamps.json`, Buffer.from(JSON.stringify(allWords)), { contentType: 'application/octet-stream', upsert: true })
            .then(({ error }) => {
              if (error) {
                logger.warn({ error, videoId }, 'Failed to persist word timestamps to storage (non-blocking)')
              } else {
                logger.info({ videoId, wordCount: allWords.length }, 'Word timestamps persisted to storage')
              }
            })
        })(),
      ]).catch((err) => {
        logger.warn({ err, videoId }, 'Error in non-blocking audio/timestamps persistence (continuing pipeline)')
      })
    }

    await updateStatus('audio', 55, {
      scenes: scenesWithImages,
      audioDurations: Object.fromEntries(audioDurations),
      audioWarnings,
    })
    logger.info({ videoId, imageCount: sceneImages.length, hasAudio: !!combinedAudioBuffer, audioWarningCount: audioWarnings.length }, 'Visuals + voiceover generated')

    // ÉTAPE 3.5 : Animation Kling i2v — chaque image devient un clip animé
    // Durée calée sur la durée audio réelle de la scène (5s ou 10s selon Kling API)
    await updateStatus('visuals', 60)

    // Précalculer la durée audio par scène pour calibrer les clips.
    //
    // ── exactSceneAudioDurations (fractional seconds) ──
    // Durée réelle ElevenLabs par scène, utilisée par Ken Burns (ffmpeg accepte
    // n'importe quelle durée) ET pour trimmer/étendre chaque clip Kling afin
    // que chaque image s'aligne *exactement* sur sa voix off — sinon les
    // images « défilent » plus vite que la voix (drift cumulatif).
    //
    // ── klingSceneAudioDurations ('5' | '10') ──
    // Kling n'accepte que 5 ou 10 secondes à la génération. Seuil abaissé à
    // 5s (vs. 7.5 auparavant) : dès qu'une scène dépasse 5s on demande un
    // clip 10s et on le trim à la durée audio exacte en post — ça évite les
    // scènes où la voix continue après la coupe visuelle.
    const exactSceneAudioDurations = new Map<string, number>()
    const klingSceneAudioDurations  = new Map<string, '5' | '10'>()
    for (const audioResult of audioResults) {
      const audioDuration = audioResult.words.length > 0
        ? audioResult.words[audioResult.words.length - 1].end
        : 5
      exactSceneAudioDurations.set(audioResult.sceneId, audioDuration)
      klingSceneAudioDurations.set(audioResult.sceneId, audioDuration > 5 ? '10' : '5')
    }

    // Clips vidéo : utiliser ceux du frontend si disponibles, sinon générer via Ken Burns ou Kling i2v
    let sceneVideoUrls: Array<{ sceneId: string; videoUrl: string }>
    const kenBurnsTmpDir = `clyro-kb-${videoId}`

    if (hasPreClips) {
      sceneVideoUrls = preGeneratedScenes!.map((s) => ({ sceneId: s.id, videoUrl: s.clip_url! }))
      logger.info({ videoId, clipCount: sceneVideoUrls.length }, 'Using pre-generated clips — skipped Kling i2v')
    } else if (skipAnimation) {
      // ── Ken Burns path: Remotion renders zoom+pan on each image ($0 GPU) ──
      // Triggered when animation_mode='storyboard' OR style is in KENBURNS_STYLES
      logger.info({ videoId, style, animationMode: effectiveAnimationMode, clipCount: sceneImages.length }, 'KenBurns: using Remotion for 0-GPU animation')

      const videoFormat = (params.format === '9:16' || params.format === '1:1') ? params.format : '16:9'
      const totalClips  = sceneImages.length
      let completedClips = 0

      const { join: pathJoin } = await import('path')
      const { tmpdir } = await import('os')
      const { writeFile: writeFileFn, mkdir: mkdirFn } = await import('fs/promises')
      const workDir = pathJoin(tmpdir(), kenBurnsTmpDir)
      await mkdirFn(workDir, { recursive: true })

      // Ken Burns via FFmpeg zoompan — 50× plus rapide que Remotion/Chromium,
      // aucune dépendance Chrome → plus de SIGSEGV ni de bundle webpack à bâtir.
      // Concurrence 4 : FFmpeg est léger (pas de browser), 4 clips simultanés.
      const KB_CONCURRENCY = 4

      // Index overlay_text par scene.id pour le drawtext ffmpeg.
      // Seulement alimenté si le frontend a envoyé pre_generated_scenes avec
      // un champ overlay_text non vide.
      const overlayTextBySceneId = new Map<string, string>()
      if (preGeneratedScenes) {
        for (const s of preGeneratedScenes) {
          if (s.overlay_text && s.overlay_text.trim().length > 0) {
            overlayTextBySceneId.set(s.id, s.overlay_text.trim())
          }
        }
      }

      const kbResults: PromiseSettledResult<{ sceneId: string; videoUrl: string }>[] = []
      for (let i = 0; i < sceneImages.length; i += KB_CONCURRENCY) {
        const batch = sceneImages.slice(i, i + KB_CONCURRENCY)
        const batchResults = await Promise.allSettled(
          batch.map(async ({ sceneId, imageUrl }, batchIdx) => {
            const idx = i + batchIdx
            // Durée = voix off réelle ElevenLabs. Ken Burns (ffmpeg zoompan)
            // accepte n'importe quelle valeur fractionnaire → image et voix
            // s'alignent au centième de seconde, plus de drift.
            // Fallback 5s si pas de voix (muet).
            const exactAudioDur = exactSceneAudioDurations.get(sceneId)
            const durationSec = exactAudioDur && exactAudioDur > 0.5
              ? Math.round(exactAudioDur * 100) / 100
              : 5
            const mp4Buffer = await renderKenBurnsFFmpeg({
              imageUrl,
              durationSeconds: durationSec,
              sceneIndex: idx,
              format: videoFormat as '16:9' | '9:16' | '1:1',
              overlayText: overlayTextBySceneId.get(sceneId),
            })
            // Write to temp file and expose as file:// URL for assembleVideoFromVideoClips
            const tmpPath = pathJoin(workDir, `kb_${sceneId}.mp4`)
            await writeFileFn(tmpPath, mp4Buffer)
            completedClips++
            const clipProgress = 60 + Math.round((completedClips / totalClips) * 18)
            await updateStatus('visuals', clipProgress)
            logger.info({ sceneId, durationSec, idx }, 'KenBurns: clip rendered')
            return { sceneId, videoUrl: `file://${tmpPath}` }
          })
        )
        kbResults.push(...batchResults)
      }

      sceneVideoUrls = kbResults
        .filter((r): r is PromiseFulfilledResult<{ sceneId: string; videoUrl: string }> => r.status === 'fulfilled')
        .map((r) => r.value)

      const kbFailCount = kbResults.filter((r) => r.status === 'rejected').length
      if (kbFailCount > 0) {
        logger.warn({ videoId, kbFailCount, total: sceneImages.length }, 'Some Ken Burns clips failed — falling back to static for failed scenes')
      }
      logger.info({ videoId, kbClips: sceneVideoUrls.length }, 'KenBurns clips complete')
    } else {
      // ── Kling i2v path: GPU-powered video animation ──────────────────────
      const totalClips = sceneImages.length
      let completedClips = 0

      const klingResults = await Promise.allSettled(
        sceneImages.map(async ({ sceneId, imageUrl }) => {
          const scene = storyboard.scenes.find((s) => s.id === sceneId)
          const animationPrompt = scene?.animation_prompt ?? scene?.description_visuelle ?? 'smooth cinematic camera movement, natural motion'
          const clipDuration = klingSceneAudioDurations.get(sceneId) ?? '5'
          const exactAudioDur = exactSceneAudioDurations.get(sceneId)
          const { videoUrl: falVideoUrl, model } = await generateSceneVideoAuto(imageUrl, animationPrompt, clipDuration, style)
          const storagePath = `${userId}/${videoId}/clips/scene-${sceneId}.mp4`
          let videoUrl = await uploadFalUrlToStorage(falVideoUrl, storagePath, 'videos')

          // Recalibrer la durée du clip Kling sur la durée audio réelle —
          // Kling ne sort que du 5s ou 10s, donc une scène de 6.3s voit son
          // image se couper à 5s ou traîner en freeze 3.7s sur 10s. On retaille
          // (ou on étend par freeze-frame) pour un alignement parfait.
          if (exactAudioDur && exactAudioDur > 0.5) {
            try {
              const { adjustClipDurationFromUrl } = await import('../services/ffmpeg.js')
              const adjustedPath = await adjustClipDurationFromUrl(videoUrl, exactAudioDur)
              const adjustedStoragePath = `${userId}/${videoId}/clips/scene-${sceneId}-sync.mp4`
              const { readFile: rf } = await import('fs/promises')
              const adjustedBuf = await rf(adjustedPath)
              const { data: upload, error: upErr } = await supabaseAdmin.storage
                .from('videos')
                .upload(adjustedStoragePath, adjustedBuf, { contentType: 'video/mp4', upsert: true })
              if (!upErr && upload) {
                const { data } = supabaseAdmin.storage.from('videos').getPublicUrl(adjustedStoragePath)
                videoUrl = data.publicUrl
                logger.info({ sceneId, exactAudioDur, klingDuration: clipDuration }, 'Kling clip re-synced to exact audio duration')
              }
            } catch (err) {
              // Pas d'échec du pipeline si le recalage échoue — on garde le clip original
              logger.warn({ sceneId, err }, 'Kling clip re-sync failed — using original 5/10s clip')
            }
          }

          completedClips++
          const clipProgress = 60 + Math.round((completedClips / totalClips) * 18)
          await updateStatus('visuals', clipProgress)
          logger.info({ sceneId, model, clipDuration, exactAudioDur, completedClips, totalClips }, 'Scene video generated')
          return { sceneId, videoUrl }
        })
      )

      sceneVideoUrls = klingResults
        .filter((r): r is PromiseFulfilledResult<{ sceneId: string; videoUrl: string }> => r.status === 'fulfilled')
        .map((r) => r.value)

      const klingFailCount = klingResults.filter((r) => r.status === 'rejected').length
      if (klingFailCount > 0) {
        logger.warn({ videoId, klingFailCount, total: sceneImages.length }, 'Some Kling clips failed — falling back to static for failed scenes')
      }
      logger.info({ videoId, klingClips: sceneVideoUrls.length }, 'Kling i2v complete')
    }

    // ÉTAPE 4 : Assemblage FFmpeg
    await updateStatus('assembly', 80)

    // Construire le SRT karaoke avec offsets audio cumulatifs
    let karaokeSubsContent: string | undefined
    if (audioResults.length > 0) {
      let audioOffset = 0
      const sceneWordData = audioResults.map((r) => {
        const entry = { words: r.words, audioOffset }
        const sceneDuration = r.words.length > 0 ? r.words[r.words.length - 1].end : 0
        audioOffset += sceneDuration
        return entry
      })
      karaokeSubsContent = generateKaraokeFromWords(sceneWordData)
    }

    // Télécharger la musique de fond si fournie
    let musicTmpPath: string | undefined
    if (musicTrackUrl) {
      musicTmpPath = await downloadMusicTrack(musicTrackUrl).catch((err) => {
        logger.warn({ err }, 'Failed to download music track — continuing without music')
        return undefined
      })
    }

    // Si tous les clips vidéo animés ont réussi → assemble depuis clips Kling/wan
    // Sinon → fallback sur assemblage statique (loopImageToClip)
    const mp4Buffer = sceneVideoUrls.length === sceneImages.length
      ? await assembleVideoFromVideoClips({
          sceneVideoUrls,
          voiceoverBuffer: combinedAudioBuffer,
          backgroundMusicPath: musicTmpPath,
          karaokeSubsContent,
          // Ken Burns clips are already uniform h264/yuv420p — skip re-encode + xfade
          skipTransitions: skipAnimation,
        })
      : await assembleVideo({
          scenes: scenesWithImages,
          sceneImages,
          voiceoverBuffer: combinedAudioBuffer,
          backgroundMusicPath: musicTmpPath,
        })

    // Cleanup musique tmp
    if (musicTmpPath) await unlink(musicTmpPath).catch(() => null)

    // ÉTAPE 5 : Upload Supabase Storage (avec retry — un 503 transient sur
    // un upload de 300 MB ne doit pas jeter toute la pipeline à la poubelle)
    await updateStatus('assembly', 90)
    const storagePath = `${userId}/${videoId}/output.mp4`

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
        // Exponential backoff: 5s, 15s, 30s
        await new Promise((r) => setTimeout(r, [5_000, 15_000, 30_000][attempt - 1] ?? 30_000))
      }
    }
    if (uploadError) throw new Error(`Storage upload failed after ${UPLOAD_MAX_RETRIES} attempts: ${uploadError.message}`)

    // Signed URL 1 an — avec retry (Supabase Storage peut être lent)
    let outputUrl = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: signedUrl, error: signError } = await supabaseAdmin.storage
        .from('videos')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365)
      if (signedUrl?.signedUrl) {
        outputUrl = signedUrl.signedUrl
        break
      }
      logger.warn({ attempt, signError, videoId }, 'createSignedUrl failed, retrying…')
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }

    if (!outputUrl) {
      throw new Error('Failed to create signed URL after 3 attempts — storage_path saved for manual recovery')
    }

    await supabaseAdmin
      .from('videos')
      .update({ status: 'done', output_url: outputUrl, metadata: { progress: 100, scenes: scenesWithImages, storage_path: storagePath } })
      .eq('id', videoId)

    logger.info({ videoId, outputUrl }, 'Faceless pipeline completed')

    // Libère explicitement la heap V8 avant que BullMQ ne pick le job suivant.
    // Le mp4Buffer final (~50-200 MB) + combinedAudioBuffer (~30 MB) restent
    // sinon en mémoire jusqu'au prochain cycle GC naturel, ce qui déclenche
    // un OOM sur le worker Render si un nouveau job démarre tout de suite.
    // Nécessite --expose-gc dans NODE_OPTIONS (voir render.yaml).
    if (typeof global.gc === 'function') {
      try {
        global.gc()
        logger.info({ videoId, heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) }, 'Post-pipeline GC triggered')
      } catch {
        // gc() may throw if --expose-gc isn't set — ignore, it's a best effort
      }
    }

    await sendVideoReadyEmail(userEmail, title, outputUrl).catch((err) =>
      logger.warn({ err }, 'Failed to send video ready email (non-blocking)')
    )
    finished = true
    clearTimeout(watchdog)
  } catch (err) {
    finished = true
    clearTimeout(watchdog)
    const errorMessage = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { extra: { videoId, userId } })
    logger.error({ err, videoId }, 'Faceless pipeline error')

    // Preserve existing metadata (scenes, script_draft, voice_id, etc.) so the
    // "revert to draft" flow can reconstruct wizard state without re-entering everything.
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
  } finally {
    // Cleanup Ken Burns temp dir (non-blocking)
    const { join: _pathJoin } = await import('path')
    const { tmpdir: _tmpdir } = await import('os')
    const { rm: _rmFn } = await import('fs/promises')
    _rmFn(_pathJoin(_tmpdir(), `clyro-kb-${videoId}`), { recursive: true, force: true }).catch(() => null)
  }
}

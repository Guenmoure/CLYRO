import { spawn } from 'child_process'
import { writeFile, readFile, unlink, mkdir, rm, copyFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger'
import type { WordTimestamp } from './elevenlabs'

/**
 * Normalise le volume audio (EBU R128 loudnorm) en deux passes.
 * Pass 1 : mesure integrated loudness, true peak, LRA
 * Pass 2 : applique la correction pour atteindre -16 LUFS (standard broadcast/streaming)
 */
export async function normalizeAudioLoudness(
  inputPath: string,
  outputPath: string,
  targetLufs: number = -16,
): Promise<void> {
  // Pass 1 : mesure (output vers /dev/null, stats dans stderr)
  const stats = await runFFmpegWithOutput([
    '-i', inputPath,
    '-af', `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`,
    '-f', 'null', '/dev/null',
  ])

  // Parse measured values from stderr JSON
  const jsonMatch = stats.match(/\{[^}]*"input_i"[^}]*\}/s)
  let loudnormFilter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`

  if (jsonMatch) {
    try {
      const measured = JSON.parse(jsonMatch[0])
      loudnormFilter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`
    } catch {
      logger.warn('loudnorm: failed to parse pass 1 stats, using single-pass mode')
    }
  }

  // Pass 2 : applique la correction
  await runFFmpeg([
    '-i', inputPath,
    '-af', loudnormFilter,
    '-c:a', 'aac', '-b:a', '192k',
    outputPath,
  ])
}

/**
 * Exécute une commande ffmpeg et retourne stderr (pour analyse des stats loudnorm)
 */
async function runFFmpegWithOutput(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      // Code 0 or non-zero is fine for measurement pass
      resolve(stderr)
    })

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`))
    })
  })
}

/**
 * Exécute une commande ffmpeg et retourne stderr/stdout
 * Utilise child_process.spawn (jamais exec pour éviter injection shell)
 */
async function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', ['-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    process.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        logger.error({ code, stderr: stderr.slice(-500) }, 'FFmpeg error')
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-200)}`))
      }
    })

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`))
    })
  })
}

/**
 * Crée un clip vidéo à partir d'une image en la loopant sur la durée donnée
 */
export async function loopImageToClip(
  imageBuffer: Buffer,
  durationSeconds: number,
  outputPath: string
): Promise<void> {
  const tempImagePath = join(tmpdir(), `clyro-img-${randomUUID()}.jpg`)

  try {
    await writeFile(tempImagePath, imageBuffer)

    await runFFmpeg([
      '-loop', '1',
      '-i', tempImagePath,
      '-t', String(durationSeconds),
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-r', '24',
      '-threads', '1',
      outputPath,
    ])
  } finally {
    await unlink(tempImagePath).catch(() => null)
  }
}

/**
 * Concatène une liste de clips vidéo en une seule vidéo
 */
export async function concatenateClips(
  clipPaths: string[],
  outputPath: string
): Promise<void> {
  const listPath = join(tmpdir(), `clyro-concat-${randomUUID()}.txt`)

  try {
    const listContent = clipPaths.map((p) => `file '${p}'`).join('\n')
    await writeFile(listPath, listContent)

    await runFFmpeg([
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath,
    ])
  } finally {
    await unlink(listPath).catch(() => null)
  }
}

/**
 * Mixe la voix off (volume 100%) et la musique de fond avec ducking dynamique.
 *
 * Ducking intelligent via sidechaincompress :
 *   - Musique à 35% en l'absence de voix (intro / transitions / silence)
 *   - Compression 8:1 quand la voix dépasse -36 dB → musique réduite à ~4%
 *   - Attack 5ms (duck immédiat), release 500ms (remontée progressive)
 * Résultat : musique audible entre les phrases, inaudible sous la narration.
 */
export async function mixAudio(
  videoPath: string,
  voiceoverBuffer: Buffer,
  backgroundMusicPath: string | null,
  outputPath: string
): Promise<void> {
  const tempAudioPath = join(tmpdir(), `clyro-voice-${randomUUID()}.mp3`)

  try {
    await writeFile(tempAudioPath, voiceoverBuffer)

    if (backgroundMusicPath) {
      // Normalize voiceover in the filter chain (single-pass loudnorm within the complex filter)
      // Smart ducking: music ducks when voice is detected, fills during silence
      const duckFilter = [
        '[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[voice]',
        '[2:a]volume=0.35,aloop=loop=-1:size=2147483647[music_loop]',
        '[music_loop][voice]sidechaincompress=threshold=0.015:ratio=8:attack=5:release=500[music_ducked]',
        '[voice][music_ducked]amix=inputs=2:duration=first:dropout_transition=0[aout]',
      ].join(';')

      await runFFmpeg([
        '-i', videoPath,
        '-i', tempAudioPath,
        '-i', backgroundMusicPath,
        '-filter_complex', duckFilter,
        '-map', '0:v',
        '-map', '[aout]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        outputPath,
      ])
    } else {
      // Seulement la voix off
      await runFFmpeg([
        '-i', videoPath,
        '-i', tempAudioPath,
        '-map', '0:v',
        '-map', '1:a',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        outputPath,
      ])
    }
  } finally {
    await unlink(tempAudioPath).catch(() => null)
  }
}

/**
 * Ajoute des sous-titres/overlays texte sur la vidéo
 */
export async function addSubtitles(
  videoPath: string,
  scenes: Array<{ texte_voix: string; duree_estimee: number }>,
  outputPath: string
): Promise<void> {
  // Générer le fichier SRT
  const srtContent = scenes
    .reduce(
      (acc, scene, index) => {
        const startTime = scenes
          .slice(0, index)
          .reduce((sum, s) => sum + s.duree_estimee, 0)
        const endTime = startTime + scene.duree_estimee

        const formatTime = (seconds: number) => {
          const h = Math.floor(seconds / 3600)
          const m = Math.floor((seconds % 3600) / 60)
          const s = Math.floor(seconds % 60)
          const ms = 0
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
        }

        return (
          acc +
          `${index + 1}\n${formatTime(startTime)} --> ${formatTime(endTime)}\n${scene.texte_voix}\n\n`
        )
      },
      ''
    )

  const srtPath = join(tmpdir(), `clyro-subs-${randomUUID()}.srt`)

  try {
    await writeFile(srtPath, srtContent)

    await runFFmpeg([
      '-i', videoPath,
      '-vf', `subtitles=${srtPath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2'`,
      '-c:a', 'copy',
      outputPath,
    ])
  } finally {
    await unlink(srtPath).catch(() => null)
  }
}

/**
 * Concatène des clips MP4 avec une transition cross-dissolve entre chaque clip.
 * Utilise le filtre FFmpeg xfade. Tous les clips doivent avoir le même codec/résolution/fps.
 * @param clipPaths - Chemins vers les clips re-encodés (même codec, fps, résolution)
 * @param outputPath - Chemin de sortie
 * @param transitionDuration - Durée de la transition en secondes (default 0.4s)
 */
export async function concatenateClipsWithTransitions(
  clipPaths: string[],
  outputPath: string,
  transitionDuration = 0.4
): Promise<void> {
  if (clipPaths.length < 2) {
    return concatenateClips(clipPaths, outputPath)
  }

  // Obtenir la durée de chaque clip via ffprobe
  async function getClipDuration(clipPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        clipPath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = ''
      proc.stdout?.on('data', (d: Buffer) => { out += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(parseFloat(out.trim()) || 5)
        else reject(new Error(`ffprobe failed: code ${code}`))
      })
      proc.on('error', reject)
    })
  }

  const durations = await Promise.all(clipPaths.map(getClipDuration))

  // Construire le filter_complex xfade pour N clips
  // [0:v][1:v]xfade=transition=dissolve:duration=T:offset=D0-T[v01]
  // [v01][2:v]xfade=transition=dissolve:duration=T:offset=D0+D1-2T[v012]...
  const inputs = clipPaths.flatMap((p) => ['-i', p])
  const td = transitionDuration

  let filterParts = ''
  let currentLabel = '[0:v]'
  let cumulativeOffset = 0

  for (let i = 1; i < clipPaths.length; i++) {
    const prevDuration = durations[i - 1]
    const offset = cumulativeOffset + prevDuration - td
    const outLabel = i === clipPaths.length - 1 ? '[vout]' : `[v${i}]`
    filterParts += `${currentLabel}[${i}:v]xfade=transition=dissolve:duration=${td}:offset=${offset.toFixed(3)}${outLabel};`
    currentLabel = outLabel
    cumulativeOffset += prevDuration - td
  }

  // Retirer le dernier ";" et le label de sortie en trop
  filterParts = filterParts.slice(0, -1)

  await runFFmpeg([
    ...inputs,
    '-filter_complex', filterParts,
    '-map', '[vout]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '26',
    '-pix_fmt', 'yuv420p',
    '-r', '24',
    outputPath,
  ])
}

// ── Helpers SRT et clips Kling ─────────────────────────────────────────────

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/**
 * Génère un SRT karaoke mot par mot à partir des timestamps ElevenLabs.
 * Chaque résultat de scène est décalé par l'offset cumulatif audio.
 */
export function generateKaraokeFromWords(
  sceneResults: Array<{ words: WordTimestamp[]; audioOffset: number }>
): string {
  let index = 1
  let srt = ''

  for (const { words, audioOffset } of sceneResults) {
    for (const w of words) {
      const start = audioOffset + w.start
      const end = audioOffset + w.end
      srt += `${index}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${w.word}\n\n`
      index++
    }
  }

  return srt
}

/**
 * Télécharge un clip vidéo depuis une URL vers un fichier temporaire.
 * Timeout 90s pour éviter un hang infini sur des URLs qui ne répondent pas.
 */
async function downloadVideoUrl(url: string, outputPath: string): Promise<void> {
  // file:// URLs come from locally-rendered Ken Burns clips — just copy the file
  if (url.startsWith('file://')) {
    await copyFile(url.slice(7), outputPath)
    return
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`Failed to download video clip: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeFile(outputPath, buffer)
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error(`Download timed out (90s): ${url.slice(0, 80)}`)
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

interface AssembleFromClipsOptions {
  sceneVideoUrls: Array<{ sceneId: string; videoUrl: string }>
  voiceoverBuffer: Buffer | null
  backgroundMusicPath?: string
  karaokeSubsContent?: string
}

/**
 * Assemble la vidéo finale depuis des clips Kling (i2v) :
 * 1. Télécharge tous les clips en parallèle
 * 2. Re-encode chaque clip pour uniformiser codec/fps
 * 3. Concatène
 * 4. Mixe l'audio (voix off + musique)
 * 5. (optionnel) Ajoute les sous-titres karaoke mot par mot
 */
export async function assembleVideoFromVideoClips(options: AssembleFromClipsOptions): Promise<Buffer> {
  const { sceneVideoUrls, voiceoverBuffer, backgroundMusicPath, karaokeSubsContent } = options

  const workDir = join(tmpdir(), `clyro-kling-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  const tempFiles: string[] = []

  try {
    // Télécharger tous les clips Kling en parallèle
    const downloadedPaths = await Promise.all(
      sceneVideoUrls.map(async ({ sceneId, videoUrl }) => {
        const clipPath = join(workDir, `raw_${sceneId}.mp4`)
        await downloadVideoUrl(videoUrl, clipPath)
        tempFiles.push(clipPath)
        return { sceneId, clipPath }
      })
    )

    if (downloadedPaths.length === 0) throw new Error('No Kling clips to assemble')

    // Re-encoder chaque clip pour uniformiser résolution / fps / codec
    const CLIP_CONCURRENCY = 4
    const reEncodedPaths: string[] = []

    for (let i = 0; i < downloadedPaths.length; i += CLIP_CONCURRENCY) {
      const batch = downloadedPaths.slice(i, i + CLIP_CONCURRENCY)
      const batchPaths = await Promise.all(
        batch.map(async ({ sceneId, clipPath }) => {
          const reEncodedPath = join(workDir, `enc_${sceneId}.mp4`)
          await runFFmpeg([
            '-i', clipPath,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '26',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
            '-r', '24',
            '-an',
            reEncodedPath,
          ])
          tempFiles.push(reEncodedPath)
          return reEncodedPath
        })
      )
      reEncodedPaths.push(...batchPaths)
    }

    // Concatène avec transitions cross-dissolve (0.4s) entre clips
    const concatPath = join(workDir, 'concat.mp4')
    tempFiles.push(concatPath)
    if (reEncodedPaths.length === 1) {
      // Un seul clip — pas de transition
      await concatenateClips(reEncodedPaths, concatPath)
    } else {
      await concatenateClipsWithTransitions(reEncodedPaths, concatPath, 0.4)
    }

    let currentPath = concatPath

    // Mixe l'audio avec normalisation loudnorm EBU R128
    if (voiceoverBuffer) {
      // Normalise le voiceover à -16 LUFS avant le mix
      const rawVoicePath = join(workDir, 'voice_raw.mp3')
      const normVoicePath = join(workDir, 'voice_norm.mp3')
      await writeFile(rawVoicePath, voiceoverBuffer)
      tempFiles.push(rawVoicePath, normVoicePath)

      try {
        await normalizeAudioLoudness(rawVoicePath, normVoicePath, -16)
        const normalizedBuffer = await readFile(normVoicePath)
        const mixedPath = join(workDir, 'mixed.mp4')
        tempFiles.push(mixedPath)
        await mixAudio(currentPath, normalizedBuffer, backgroundMusicPath ?? null, mixedPath)
        currentPath = mixedPath
        logger.info('FFmpeg: voiceover normalized to -16 LUFS before mix')
      } catch (normErr) {
        // Fallback : mix sans normalisation si loudnorm échoue
        logger.warn({ normErr }, 'FFmpeg: loudnorm failed, falling back to raw voiceover')
        const mixedPath = join(workDir, 'mixed.mp4')
        tempFiles.push(mixedPath)
        await mixAudio(currentPath, voiceoverBuffer, backgroundMusicPath ?? null, mixedPath)
        currentPath = mixedPath
      }
    }

    // Sous-titres karaoke
    if (karaokeSubsContent) {
      const srtPath = join(workDir, 'karaoke.srt')
      const subtitledPath = join(workDir, 'subtitled.mp4')
      await writeFile(srtPath, karaokeSubsContent, 'utf-8')
      tempFiles.push(srtPath, subtitledPath)
      try {
        // Use comma-escaped force_style (no shell quotes needed with spawn)
        const forceStyle = 'FontName=Arial\\,FontSize=28\\,PrimaryColour=&H00FFFFFF\\,OutlineColour=&H00000000\\,Outline=2\\,Bold=1\\,Alignment=2'
        await runFFmpeg([
          '-i', currentPath,
          '-vf', `subtitles=${srtPath}:force_style=${forceStyle}`,
          '-c:a', 'copy',
          subtitledPath,
        ])
        currentPath = subtitledPath
      } catch (subErr) {
        logger.warn({ subErr }, 'FFmpeg: karaoke subtitles failed, skipping (non-blocking)')
      }
    }

    const finalBuffer = await readFile(currentPath)
    logger.info({ clipCount: sceneVideoUrls.length, outputSize: finalBuffer.length }, 'FFmpeg: Kling clips assembled')
    return finalBuffer
  } finally {
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => null)))
    await rm(workDir, { recursive: true, force: true }).catch(() => null)
  }
}

interface AssembleVideoOptions {
  scenes: Array<{
    id: string
    description_visuelle: string
    texte_voix: string
    duree_estimee: number
    image_url?: string
  }>
  sceneImages: Array<{ sceneId: string; imageUrl: string }>
  voiceoverBuffer: Buffer | null
  backgroundMusicPath?: string
  addSubtitlesFlag?: boolean
}

/**
 * Orchestre l'assemblage complet d'une vidéo :
 * 1. Loop chaque image sur la durée de scène → clip
 * 2. Concatène les clips
 * 3. Mixe l'audio (voix off + musique)
 * 4. (optionnel) Ajoute les sous-titres
 * Retourne le Buffer MP4 final
 */
export async function assembleVideo(options: AssembleVideoOptions): Promise<Buffer> {
  const { scenes, sceneImages, voiceoverBuffer, backgroundMusicPath, addSubtitlesFlag } = options

  const workDir = join(tmpdir(), `clyro-assemble-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })

  const clipPaths: string[] = []
  const tempFiles: string[] = []

  try {
    // Étape 1 : Téléchargement des images en parallèle, puis création des clips en parallèle
    // (vs. séquentiel précédent: download1 → clip1 → download2 → clip2 → …)
    const scenesToProcess = scenes.filter((s) => sceneImages.some((img) => img.sceneId === s.id))

    // Télécharger toutes les images simultanément
    const downloadedImages = await Promise.all(
      scenesToProcess.map(async (scene) => {
        const sceneImage = sceneImages.find((img) => img.sceneId === scene.id)!
        const imageResponse = await fetch(sceneImage.imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Failed to download scene image ${scene.id}: ${imageResponse.status}`)
        }
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        return { scene, imageBuffer }
      })
    )

    // Créer tous les clips en parallèle (max 4 simultanés pour ne pas saturer le CPU)
    const CLIP_CONCURRENCY = 4
    const orderedClipPaths: string[] = []

    for (let i = 0; i < downloadedImages.length; i += CLIP_CONCURRENCY) {
      const batch = downloadedImages.slice(i, i + CLIP_CONCURRENCY)
      const batchPaths = await Promise.all(
        batch.map(async ({ scene, imageBuffer }) => {
          const clipPath = join(workDir, `clip_${scene.id}.mp4`)
          await loopImageToClip(imageBuffer, scene.duree_estimee, clipPath)
          tempFiles.push(clipPath)
          return clipPath
        })
      )
      orderedClipPaths.push(...batchPaths)
    }

    clipPaths.push(...orderedClipPaths)

    if (clipPaths.length === 0) {
      throw new Error('No clips generated — check scene images')
    }

    // Étape 2 : Concaténer les clips
    const concatPath = join(workDir, 'concat.mp4')
    tempFiles.push(concatPath)
    await concatenateClips(clipPaths, concatPath)

    // Étape 3 : Mixer l'audio
    let currentPath = concatPath

    if (voiceoverBuffer) {
      const mixedPath = join(workDir, 'mixed.mp4')
      tempFiles.push(mixedPath)
      await mixAudio(currentPath, voiceoverBuffer, backgroundMusicPath ?? null, mixedPath)
      currentPath = mixedPath
    }

    // Étape 4 : Sous-titres (optionnel)
    if (addSubtitlesFlag) {
      const subtitledPath = join(workDir, 'subtitled.mp4')
      tempFiles.push(subtitledPath)
      await addSubtitles(currentPath, scenes, subtitledPath)
      currentPath = subtitledPath
    }

    // Lire le fichier final
    const finalBuffer = await readFile(currentPath)

    logger.info(
      { sceneCount: scenes.length, outputSize: finalBuffer.length },
      'FFmpeg: video assembled'
    )

    return finalBuffer
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => null)
  }
}

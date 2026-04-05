import { spawn } from 'child_process'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger'

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
 * Mixe la voix off (volume 100%) et la musique de fond (volume 15%) avec la vidéo
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
      // Mix voix off (100%) + musique de fond (15%)
      await runFFmpeg([
        '-i', videoPath,
        '-i', tempAudioPath,
        '-i', backgroundMusicPath,
        '-filter_complex',
        '[1:a]volume=1.0[voice];[2:a]volume=0.15[music];[voice][music]amix=inputs=2:duration=first[aout]',
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
    // Cleanup des fichiers temporaires
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => null)))
    await unlink(workDir).catch(() => null)
  }
}

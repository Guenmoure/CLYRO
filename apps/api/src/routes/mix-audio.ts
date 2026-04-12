import { Router, Request, Response } from 'express'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { mixAudio } from '../services/ffmpeg'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { authMiddleware } from '../middleware/auth'

export const mixAudioRouter = Router()
mixAudioRouter.use(authMiddleware)

/**
 * POST /api/v1/mix-audio
 *
 * Mixe une voix off et une musique de fond sur une vidéo via FFmpeg.
 * Voix off : volume 100% — musique de fond : volume 15%
 *
 * Body JSON :
 *   videoUrl         string  — URL de la vidéo source (MP4)
 *   voiceoverUrl     string  — URL de la voix off (MP3/AAC)
 *   backgroundMusicUrl? string — URL de la musique de fond (MP3/AAC)
 *
 * Réponse :
 *   { videoUrl: string }  — URL publique Supabase Storage ou fallback base64 data URI
 */
mixAudioRouter.post('/mix-audio', async (req: Request, res: Response) => {
  const { videoUrl, voiceoverUrl, backgroundMusicUrl } = req.body as {
    videoUrl: string
    voiceoverUrl: string
    backgroundMusicUrl?: string
  }

  if (!videoUrl || !voiceoverUrl) {
    res.status(400).json({ error: 'videoUrl and voiceoverUrl are required' })
    return
  }

  const workDir = join(tmpdir(), `clyro-mix-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  const tempFiles: string[] = []

  try {
    // Télécharger la vidéo source
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) throw new Error(`Failed to download video: ${videoRes.status}`)
    const videoPath = join(workDir, 'input.mp4')
    await writeFile(videoPath, Buffer.from(await videoRes.arrayBuffer()))
    tempFiles.push(videoPath)

    // Télécharger la voix off
    const voiceRes = await fetch(voiceoverUrl)
    if (!voiceRes.ok) throw new Error(`Failed to download voiceover: ${voiceRes.status}`)
    const voiceoverBuffer = Buffer.from(await voiceRes.arrayBuffer())

    // Télécharger la musique de fond (optionnel)
    let bgMusicPath: string | null = null
    if (backgroundMusicUrl) {
      try {
        const bgRes = await fetch(backgroundMusicUrl)
        if (bgRes.ok) {
          bgMusicPath = join(workDir, 'bg.mp3')
          await writeFile(bgMusicPath, Buffer.from(await bgRes.arrayBuffer()))
          tempFiles.push(bgMusicPath)
        }
      } catch {
        logger.warn({ backgroundMusicUrl }, 'mix-audio: background music download failed, skipping')
      }
    }

    const outputPath = join(workDir, 'output.mp4')
    tempFiles.push(outputPath)

    await mixAudio(videoPath, voiceoverBuffer, bgMusicPath, outputPath)

    const outputBuffer = await readFile(outputPath)

    // Upload vers Supabase Storage
    const storageKey = `mixed-videos/${randomUUID()}.mp4`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('generated-videos')
      .upload(storageKey, outputBuffer, { contentType: 'video/mp4', upsert: false })

    if (uploadError) {
      logger.warn({ uploadError }, 'mix-audio: Supabase upload failed, streaming buffer directly')
      res.set('Content-Type', 'video/mp4')
      res.send(outputBuffer)
      return
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('generated-videos')
      .getPublicUrl(storageKey)

    logger.info({ storageKey, size: outputBuffer.length }, 'mix-audio: video uploaded to Supabase')
    res.json({ videoUrl: urlData.publicUrl })
  } catch (err) {
    logger.error({ err }, 'mix-audio: failed')
    res.status(500).json({ error: err instanceof Error ? err.message : 'Audio mix failed' })
  } finally {
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => null)))
    await mkdir(workDir).catch(() => null) // ensure cleanup attempt
  }
})

import path from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'
import { logger } from '../lib/logger'
import type { BrandOverlayProps, KenBurnsClipProps } from '@clyro/video'

const FPS = 30

interface BrandConfig {
  logo_url?: string
  primary_color: string
  secondary_color?: string
  font_family?: string
  style?: string
}

interface Scene {
  id: string
  description_visuelle: string
  texte_voix: string
  duree_estimee: number
  image_url?: string
  display_text?: string
  animation_type?: 'slide-in' | 'zoom' | 'fade' | 'particle-burst' | 'typewriter'
  scene_type?: 'text_hero' | 'split_text_image' | 'product_showcase' | 'stats_counter' | 'cta_end' | 'image_full'
  needs_background?: boolean
  cta_text?: string
}

export interface RenderMotionVideoOptions {
  scenes: Scene[]
  brandConfig: BrandConfig
  format: '9:16' | '1:1' | '16:9'
  duration: string
  voiceoverBuffer?: Buffer | null
  musicBuffer?: Buffer | null
}

// Format → composition ID + dimensions
// DynamicMotion uses the scene_type-aware router (DynamicComposition)
const FORMAT_MAP: Record<string, { compositionId: string; width: number; height: number }> = {
  '16:9': { compositionId: 'DynamicMotion-16-9', width: 1920, height: 1080 },
  '9:16': { compositionId: 'DynamicMotion-9-16', width: 1080, height: 1920 },
  '1:1':  { compositionId: 'DynamicMotion-1-1',  width: 1080, height: 1080 },
}

// Cache the webpack bundle path across requests (built once per process)
let cachedBundlePath: string | null = null

async function getBundle(): Promise<string> {
  if (cachedBundlePath) return cachedBundlePath

  // Dynamic import to avoid loading webpack at startup
  const { bundle } = await import('@remotion/bundler')

  // The Root.tsx entry point — detect dev (ts-node) vs prod (compiled JS) from __dirname
  // During dev:  __dirname = src/services/  → use .tsx
  // After build: __dirname = dist/services/ → use .js
  const isDev = __dirname.includes(`${path.sep}src${path.sep}`)
  const entryPoint = path.resolve(__dirname, `../remotion/Root${isDev ? '.tsx' : '.js'}`)

  logger.info({ entryPoint }, 'Remotion: building bundle (first render)...')

  const bundlePath = await bundle({
    entryPoint,
    onProgress: (progress) => {
      if (progress % 25 === 0) logger.info({ progress }, 'Remotion bundle progress')
    },
  })

  cachedBundlePath = bundlePath
  logger.info({ bundlePath }, 'Remotion: bundle ready')
  return bundlePath
}

// ── Ken Burns movement presets — varied per scene index ────────────────────────

type KBPreset = Omit<KenBurnsClipProps, 'imageUrl'>

const KB_PRESETS: KBPreset[] = [
  { zoomFrom: 1.0,  zoomTo: 1.15, panXFrom:  0, panXTo: -3, panYFrom: 0,  panYTo: -2 }, // zoom-in, pan top-left
  { zoomFrom: 1.15, zoomTo: 1.0,  panXFrom: -3, panXTo:  0, panYFrom: -2, panYTo:  0 }, // zoom-out, pan bottom-right
  { zoomFrom: 1.0,  zoomTo: 1.12, panXFrom:  3, panXTo:  0, panYFrom:  0, panYTo:  0 }, // zoom-in, pan right→center
  { zoomFrom: 1.05, zoomTo: 1.15, panXFrom:  0, panXTo:  0, panYFrom:  2, panYTo: -2 }, // zoom-in, pan upward
  { zoomFrom: 1.1,  zoomTo: 1.0,  panXFrom:  0, panXTo:  3, panYFrom:  0, panYTo:  0 }, // zoom-out, drift right
  { zoomFrom: 1.0,  zoomTo: 1.1,  panXFrom: -2, panXTo:  2, panYFrom: -1, panYTo:  1 }, // zoom-in, diagonal
]

export interface RenderKenBurnsOptions {
  imageUrl: string       // HTTPS URL of the source image
  durationSeconds: number
  sceneIndex?: number    // used to pick movement preset
  format?: '16:9' | '9:16' | '1:1'
}

const FORMAT_DIMS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
}

/**
 * Renders a Ken Burns clip (zoom+pan on a static image) using Remotion.
 * $0 GPU cost — pure CPU/Chromium rendering.
 * Replaces Kling i2v for illustration styles (whiteboard, minimaliste, infographie, stock-vo).
 */
export async function renderKenBurnsClip(options: RenderKenBurnsOptions): Promise<Buffer> {
  const { imageUrl, durationSeconds, sceneIndex = 0, format = '16:9' } = options
  const { readFile } = await import('fs/promises')
  const { selectComposition, renderMedia } = await import('@remotion/renderer')

  const preset = KB_PRESETS[sceneIndex % KB_PRESETS.length]
  const { width, height } = FORMAT_DIMS[format]
  const durationInFrames = Math.max(FPS, Math.round(durationSeconds * FPS))

  // Convert image to base64 data URL — Chrome headless blocks CDN URLs
  let imageDataUrl = imageUrl
  try {
    const res = await fetch(imageUrl)
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      const ext = (imageUrl.split('.').pop()?.split('?')[0] ?? 'jpeg').toLowerCase()
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      imageDataUrl = `data:${mime};base64,${buf.toString('base64')}`
    }
  } catch (err) {
    logger.warn({ err, imageUrl }, 'KenBurns: could not prefetch image, using URL directly')
  }

  const bundlePath = await getBundle()
  const inputProps: KenBurnsClipProps = { ...preset, imageUrl: imageDataUrl }

  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: 'KenBurnsClip',
    inputProps: inputProps as unknown as Record<string, unknown>,
  })

  const outputPath = path.join(tmpdir(), `clyro-kb-${randomUUID()}.mp4`)

  try {
    await renderMedia({
      composition: { ...composition, durationInFrames, width, height },
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: inputProps as unknown as Record<string, unknown>,
      concurrency: 2,
    })

    const mp4 = await readFile(outputPath)
    logger.info({ sceneIndex, durationSeconds, format, outputSize: mp4.length }, 'KenBurns: clip rendered')
    return mp4
  } finally {
    await unlink(outputPath).catch(() => null)
  }
}

export interface RenderMotionVideoResult {
  mp4: Buffer
  thumbnail: Buffer | null  // PNG frame at 3 s, null if renderStill failed
}

/**
 * Renders a Motion Design video using Remotion.
 * Also captures a thumbnail PNG at the 3-second mark via renderStill.
 */
export async function renderMotionVideo(options: RenderMotionVideoOptions): Promise<RenderMotionVideoResult> {
  const { scenes, brandConfig, format, voiceoverBuffer, musicBuffer } = options

  const { selectComposition, renderMedia } = await import('@remotion/renderer')

  const { readFile } = await import('fs/promises')

  const formatKey = (format in FORMAT_MAP ? format : '16:9') as '9:16' | '1:1' | '16:9'
  const { compositionId, width, height } = FORMAT_MAP[formatKey]

  // Total duration in frames from scene durations
  const durationInFrames = Math.max(
    FPS, // minimum 1 second
    scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.duree_estimee * FPS)), 0)
  )

  // Convert voiceover + music to base64 data URLs — Chrome headless blocks file:// URLs
  let audioSrc: string | undefined
  if (voiceoverBuffer && voiceoverBuffer.length > 0) {
    audioSrc = `data:audio/mpeg;base64,${voiceoverBuffer.toString('base64')}`
    logger.info({ bytes: voiceoverBuffer.length }, 'Remotion: audio converted to data URL')
  }
  let musicSrc: string | undefined
  if (musicBuffer && musicBuffer.length > 0) {
    musicSrc = `data:audio/mpeg;base64,${musicBuffer.toString('base64')}`
    logger.info({ bytes: musicBuffer.length }, 'Remotion: music converted to data URL')
  }

  const tempFiles: string[] = []

  try {

    // Pre-download all scene images and convert to base64 data URLs.
    // Chrome headless blocks file:// and may time out on CDN URLs (fal.ai etc.).
    // Data URLs are served inline and bypass all network/file restrictions.
    const scenesWithLocalImages = await Promise.all(
      scenes.map(async (scene) => {
        if (!scene.image_url) return scene
        try {
          const res = await fetch(scene.image_url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buf = Buffer.from(await res.arrayBuffer())
          if (buf.length === 0) throw new Error('Empty image response')
          const ext = (scene.image_url.split('.').pop()?.split('?')[0] ?? 'jpeg').toLowerCase()
          const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
          const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
          return { ...scene, image_url: dataUrl }
        } catch (err) {
          logger.warn({ err, image_url: scene.image_url }, 'Remotion: could not fetch scene image, rendering without')
          return { ...scene, image_url: undefined }
        }
      })
    )
    logger.info({ sceneCount: scenesWithLocalImages.length }, 'Remotion: scene images converted to data URLs')

    const bundlePath = await getBundle()

    const inputProps: BrandOverlayProps = {
      scenes: scenesWithLocalImages,
      brandConfig,
      format: formatKey,
      audioSrc,
      musicSrc,
    }

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: compositionId,
      inputProps: inputProps as unknown as Record<string, unknown>,
    })

    const outputPath = path.join(tmpdir(), `remotion-output-${randomUUID()}.mp4`)
    tempFiles.push(outputPath)

    logger.info({ compositionId, durationInFrames, width, height }, 'Remotion: starting render')

    await renderMedia({
      composition: { ...composition, durationInFrames, width, height },
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: inputProps as unknown as Record<string, unknown>,
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 20 === 0) {
          logger.info({ progress: Math.round(progress * 100) }, 'Remotion render progress')
        }
      },
    })

    const mp4 = await readFile(outputPath)
    logger.info(
      { outputSize: mp4.length, compositionId, sceneCount: scenes.length },
      'Remotion: render complete'
    )

    // ── Thumbnail at 3 s ────────────────────────────────────────────────────
    let thumbnail: Buffer | null = null
    try {
      const { renderStill } = await import('@remotion/renderer')
      const thumbFrame = Math.min(3 * FPS, durationInFrames - 1)
      const thumbPath = path.join(tmpdir(), `remotion-thumb-${randomUUID()}.png`)
      tempFiles.push(thumbPath)
      await renderStill({
        composition: { ...composition, durationInFrames, width, height },
        serveUrl: bundlePath,
        output: thumbPath,
        frame: thumbFrame,
        inputProps: inputProps as unknown as Record<string, unknown>,
      })
      thumbnail = await readFile(thumbPath)
      logger.info({ thumbSize: thumbnail.length, frame: thumbFrame }, 'Remotion: thumbnail captured')
    } catch (thumbErr) {
      logger.warn({ thumbErr }, 'Remotion: thumbnail capture failed — continuing without')
    }

    return { mp4, thumbnail }
  } finally {
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => null)))
  }
}

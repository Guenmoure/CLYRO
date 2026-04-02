import path from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'
import { logger } from '../lib/logger'
import type { BrandOverlayProps } from '../remotion/BrandOverlay'

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
}

export interface RenderMotionVideoOptions {
  scenes: Scene[]
  brandConfig: BrandConfig
  format: '9:16' | '1:1' | '16:9'
  duration: string
  voiceoverBuffer?: Buffer | null
}

// Format → composition ID + dimensions
const FORMAT_MAP: Record<string, { compositionId: string; width: number; height: number }> = {
  '16:9': { compositionId: 'BrandOverlay-16-9', width: 1920, height: 1080 },
  '9:16': { compositionId: 'BrandOverlay-9-16', width: 1080, height: 1920 },
  '1:1':  { compositionId: 'BrandOverlay-1-1',  width: 1080, height: 1080 },
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

/**
 * Renders a Motion Design video using Remotion.
 * Returns an MP4 Buffer.
 */
export async function renderMotionVideo(options: RenderMotionVideoOptions): Promise<Buffer> {
  const { scenes, brandConfig, format, voiceoverBuffer } = options

  const { selectComposition, renderMedia } = await import('@remotion/renderer')

  const { readFile } = await import('fs/promises')

  const formatKey = (format in FORMAT_MAP ? format : '16:9') as '9:16' | '1:1' | '16:9'
  const { compositionId, width, height } = FORMAT_MAP[formatKey]

  // Total duration in frames from scene durations
  const durationInFrames = Math.max(
    FPS, // minimum 1 second
    scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.duree_estimee * FPS)), 0)
  )

  // Convert voiceover to a base64 data URL — Chrome headless blocks file:// URLs
  let audioSrc: string | undefined
  if (voiceoverBuffer && voiceoverBuffer.length > 0) {
    audioSrc = `data:audio/mpeg;base64,${voiceoverBuffer.toString('base64')}`
    logger.info({ bytes: voiceoverBuffer.length }, 'Remotion: audio converted to data URL')
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

    const buffer = await readFile(outputPath)
    logger.info(
      { outputSize: buffer.length, compositionId, sceneCount: scenes.length },
      'Remotion: render complete'
    )
    return buffer
  } finally {
    await Promise.all(tempFiles.map((f) => unlink(f).catch(() => null)))
  }
}

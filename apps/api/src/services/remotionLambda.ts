/**
 * CLYRO — Remotion Lambda Service
 *
 * Alternative cloud-based renderer using AWS Lambda.
 * Activé quand USE_REMOTION_LAMBDA=true dans l'environnement.
 *
 * Setup requis (une seule fois par région AWS) :
 *   npx remotion lambda policies validate
 *   npx remotion lambda functions deploy --memory=3009 --timeout=240 --disk=2048
 *   npx remotion lambda sites create apps/api/src/remotion/Root.tsx --site-name=clyro-motion
 *
 * Variables d'env nécessaires :
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   REMOTION_LAMBDA_FUNCTION_NAME  (ex: remotion-render-4-0-443-mem3009mb-disk2048mb-240sec)
 *   REMOTION_LAMBDA_SERVE_URL      (ex: https://xxxxx.s3.eu-west-3.amazonaws.com/sites/clyro-motion/index.html)
 */

import { logger } from '../lib/logger'
import type { RenderMotionVideoOptions } from './remotion'

export function isLambdaEnabled(): boolean {
  return (
    process.env.USE_REMOTION_LAMBDA === 'true' &&
    !!process.env.REMOTION_LAMBDA_FUNCTION_NAME &&
    !!process.env.REMOTION_LAMBDA_SERVE_URL &&
    !!process.env.AWS_REGION
  )
}

const FORMAT_MAP: Record<string, { compositionId: string; width: number; height: number }> = {
  '16:9': { compositionId: 'BrandOverlay-16-9', width: 1920, height: 1080 },
  '9:16': { compositionId: 'BrandOverlay-9-16', width: 1080, height: 1920 },
  '1:1':  { compositionId: 'BrandOverlay-1-1',  width: 1080, height: 1080 },
}

const FPS = 30

/**
 * Renders a Motion Design video via AWS Lambda.
 * Returns the S3 output URL (not a Buffer — Lambda writes to S3 directly).
 */
export async function renderMotionVideoLambda(
  options: RenderMotionVideoOptions
): Promise<string> {
  const { renderMediaOnLambda, speculateFunctionName } = await import('@remotion/lambda/client')

  const { scenes, brandConfig, format, voiceoverBuffer } = options

  const formatKey = (format in FORMAT_MAP ? format : '16:9') as '9:16' | '1:1' | '16:9'
  const { compositionId, width, height } = FORMAT_MAP[formatKey]

  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!
  const serveUrl    = process.env.REMOTION_LAMBDA_SERVE_URL!
  const region      = (process.env.AWS_REGION ?? 'eu-west-3') as Parameters<typeof renderMediaOnLambda>[0]['region']

  const durationInFrames = Math.max(
    FPS,
    scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.duree_estimee * FPS)), 0)
  )

  // Convert audio to data URL (same as local renderer)
  let audioSrc: string | undefined
  if (voiceoverBuffer && voiceoverBuffer.length > 0) {
    audioSrc = `data:audio/mpeg;base64,${voiceoverBuffer.toString('base64')}`
  }

  // Pre-download scene images to base64 data URLs
  const scenesWithLocalImages = await Promise.all(
    scenes.map(async (scene) => {
      if (!scene.image_url) return scene
      try {
        const res = await fetch(scene.image_url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        const ext = (scene.image_url.split('.').pop()?.split('?')[0] ?? 'jpeg').toLowerCase()
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
        return { ...scene, image_url: `data:${mime};base64,${buf.toString('base64')}` }
      } catch {
        return { ...scene, image_url: undefined }
      }
    })
  )

  logger.info({ compositionId, functionName, region }, 'Remotion Lambda: starting render')

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: compositionId,
    inputProps: {
      scenes: scenesWithLocalImages,
      brandConfig,
      format: formatKey,
      audioSrc,
    },
    codec: 'h264',
    framesPerLambda: 20,
    concurrencyPerLambda: 1,
    // Override composition dimensions + duration
    forceWidth: width,
    forceHeight: height,
    forceDurationInFrames: durationInFrames,
  })

  // Poll for completion
  const { getRenderProgress } = await import('@remotion/lambda/client')

  let done = false
  let outputUrl = ''

  while (!done) {
    await new Promise((r) => setTimeout(r, 3000))
    const progress = await getRenderProgress({ renderId, bucketName, functionName, region })

    logger.info({ progress: Math.round(progress.overallProgress * 100) }, 'Lambda render progress')

    if (progress.done) {
      outputUrl = progress.outputFile ?? ''
      done = true
    } else if (progress.fatalErrorEncountered) {
      throw new Error(`Lambda render failed: ${progress.errors?.[0]?.message ?? 'unknown error'}`)
    }
  }

  logger.info({ renderId, outputUrl }, 'Remotion Lambda: render complete')
  return outputUrl
}

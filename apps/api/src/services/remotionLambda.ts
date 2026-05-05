/**
 * CLYRO — Remotion Lambda Service
 *
 * Cloud rendering via AWS Lambda. Activé quand USE_REMOTION_LAMBDA=true
 * dans l'environnement (et que les credentials AWS sont présents).
 *
 * Setup requis (une seule fois par région AWS) :
 *   npx remotion lambda policies validate
 *   npx remotion lambda functions deploy --memory=3009 --timeout=240 --disk=2048
 *   npx remotion lambda sites create apps/api/src/remotion/Root.tsx --site-name=clyro-motion
 *
 * Variables d'env nécessaires (à définir sur clyro-worker dans Render) :
 *   USE_REMOTION_LAMBDA=true
 *   AWS_REGION (ex: eu-west-3)
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   REMOTION_LAMBDA_FUNCTION_NAME (ex: remotion-render-4-0-443-mem3009mb-disk2048mb-240sec)
 *   REMOTION_LAMBDA_SERVE_URL     (ex: https://xxxxx.s3.eu-west-3.amazonaws.com/sites/clyro-motion/index.html)
 *
 * Re-exécuter `lambda sites create` après chaque modification des composants
 * dans packages/video/src/ (sinon le serve URL pointe sur l'ancien bundle).
 */

import { logger } from '../lib/logger'
import type { RenderMotionVideoOptions, RenderMotionDesignOptions } from './remotion'
import type { MotionCompositionProps } from '@clyro/video'

export function isLambdaEnabled(): boolean {
  const enabled =
    process.env.USE_REMOTION_LAMBDA === 'true' &&
    !!process.env.REMOTION_LAMBDA_FUNCTION_NAME &&
    !!process.env.REMOTION_LAMBDA_SERVE_URL &&
    !!process.env.AWS_REGION

  if (!enabled && process.env.USE_REMOTION_LAMBDA === 'true') {
    // Opted-in but missing variables — warn once so it's visible in logs
    logger.warn(
      {
        hasFunction: !!process.env.REMOTION_LAMBDA_FUNCTION_NAME,
        hasServeUrl: !!process.env.REMOTION_LAMBDA_SERVE_URL,
        hasRegion:   !!process.env.AWS_REGION,
      },
      'Remotion Lambda: USE_REMOTION_LAMBDA=true but missing credentials — falling back to local renderer'
    )
  }

  return enabled
}

const FPS = 30

// ── Motion (legacy DynamicComposition router) ─────────────────────────────
// MUST match the composition IDs registered in apps/api/src/remotion/Root.tsx
// (lines DynamicMotion-{16-9|9-16|1-1}). Previously this map was using the
// old BrandOverlay-* IDs which worked but bypassed scene_type/animation_type
// routing — visual output drifted from the local renderer.
const MOTION_FORMAT_MAP: Record<string, { compositionId: string; width: number; height: number }> = {
  '16:9': { compositionId: 'DynamicMotion-16-9', width: 1920, height: 1080 },
  '9:16': { compositionId: 'DynamicMotion-9-16', width: 1080, height: 1920 },
  '1:1':  { compositionId: 'DynamicMotion-1-1',  width: 1080, height: 1080 },
}

// ── F2 Motion Design (MotionComposition agency-quality) ──────────────────
const MOTION_DESIGN_FORMAT_MAP: Record<string, { compositionId: string; width: number; height: number }> = {
  '16_9': { compositionId: 'MotionDesign-16-9', width: 1920, height: 1080 },
  '9_16': { compositionId: 'MotionDesign-9-16', width: 1080, height: 1920 },
  '1_1':  { compositionId: 'MotionDesign-1-1',  width: 1080, height: 1080 },
}

// Lambda function pricing scales with memory × duration. With 3009 MB allocated
// and ~30s avg per scene, a 30s video costs ~$0.005-0.01 per render. For very
// long videos (3-5 min), Lambda still beats local rendering wall-time by
// ~3-5×, but consider keeping local for short videos to save invocation cost.
const LAMBDA_MIN_DURATION_FOR_USE = 0  // 0 = always use Lambda when enabled

/**
 * Polls a Lambda render until completion. Returns the final S3 outputUrl.
 * Throws on fatal errors.
 */
async function pollLambdaRender(args: {
  renderId:     string
  bucketName:   string
  functionName: string
  region:       string
  videoLabel:   string
}): Promise<string> {
  const { getRenderProgress } = await import('@remotion/lambda/client')
  const { renderId, bucketName, functionName, region, videoLabel } = args

  let outputUrl = ''
  let done = false
  let lastProgress = -1

  while (!done) {
    await new Promise((r) => setTimeout(r, 3000))
    const progress = await getRenderProgress({
      renderId, bucketName, functionName,
      region: region as Parameters<typeof getRenderProgress>[0]['region'],
    })

    const pct = Math.round(progress.overallProgress * 100)
    // Log every 10 % progression delta to avoid log spam every 3s.
    if (pct - lastProgress >= 10) {
      logger.info({ progress: pct, label: videoLabel }, 'Lambda render progress')
      lastProgress = pct
    }

    if (progress.done) {
      outputUrl = progress.outputFile ?? ''
      done = true
    } else if (progress.fatalErrorEncountered) {
      throw new Error(`Lambda render failed (${videoLabel}): ${progress.errors?.[0]?.message ?? 'unknown error'}`)
    }
  }

  return outputUrl
}

/** Common helper to inline scene images as base64 data URLs.
 *  Lambda's serve URL bundle can't cross-origin-fetch arbitrary URLs at
 *  render time without CORS hassle — embedding the bytes is the simplest
 *  way to guarantee the images render. */
async function inlineSceneImages<S extends { image_url?: string }>(scenes: S[]): Promise<S[]> {
  return Promise.all(
    scenes.map(async (scene) => {
      if (!scene.image_url) return scene
      try {
        const res = await fetch(scene.image_url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        const ext = (scene.image_url.split('.').pop()?.split('?')[0] ?? 'jpeg').toLowerCase()
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
        return { ...scene, image_url: `data:${mime};base64,${buf.toString('base64')}` }
      } catch (err) {
        logger.warn({ err, image_url: scene.image_url }, 'Lambda: could not fetch scene image, rendering without')
        return { ...scene, image_url: undefined }
      }
    }),
  )
}

/**
 * Renders a Motion video (legacy DynamicComposition pipeline) via AWS Lambda.
 * Uses the same composition IDs as the local renderer (DynamicMotion-*) so
 * Lambda + local produce visually identical output.
 *
 * Returns the S3 output URL (Lambda writes directly to S3).
 */
export async function renderMotionVideoLambda(
  options: RenderMotionVideoOptions,
): Promise<string> {
  const { renderMediaOnLambda } = await import('@remotion/lambda/client')

  const { scenes, brandConfig, format, voiceoverBuffer, musicBuffer } = options

  const formatKey = (format in MOTION_FORMAT_MAP ? format : '16:9') as '9:16' | '1:1' | '16:9'
  const { compositionId, width, height } = MOTION_FORMAT_MAP[formatKey]

  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!
  const serveUrl     = process.env.REMOTION_LAMBDA_SERVE_URL!
  const region       = (process.env.AWS_REGION ?? 'eu-west-3') as Parameters<typeof renderMediaOnLambda>[0]['region']

  const durationInFrames = Math.max(
    FPS,
    scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.duree_estimee * FPS)), 0),
  )

  if (durationInFrames / FPS < LAMBDA_MIN_DURATION_FOR_USE) {
    throw new Error(`Video too short (${durationInFrames / FPS}s) for Lambda — caller should fall back to local`)
  }

  let audioSrc: string | undefined
  if (voiceoverBuffer && voiceoverBuffer.length > 0) {
    audioSrc = `data:audio/mpeg;base64,${voiceoverBuffer.toString('base64')}`
  }
  let musicSrc: string | undefined
  if (musicBuffer && musicBuffer.length > 0) {
    musicSrc = `data:audio/mpeg;base64,${musicBuffer.toString('base64')}`
  }

  const scenesWithLocalImages = await inlineSceneImages(scenes)

  logger.info(
    { compositionId, functionName, region, sceneCount: scenes.length, durationInFrames },
    'Remotion Lambda (Motion): starting render'
  )

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
      musicSrc,
    },
    codec: 'h264',
    // Concurrency: framesPerLambda = 999 means "single chunk per Lambda".
    // For new AWS accounts the default Lambda concurrent execution limit is
    // 10, so a video that needs N parallel chunks will queue. Once the
    // account quota is raised (request via AWS Service Quotas), reduce this
    // value to 50-100 to parallelize ~10-20× faster.
    framesPerLambda: 999,
    concurrencyPerLambda: 1,
    forceWidth: width,
    forceHeight: height,
    forceDurationInFrames: durationInFrames,
  })

  const outputUrl = await pollLambdaRender({
    renderId, bucketName, functionName, region: region as string,
    videoLabel: `motion:${compositionId}`,
  })

  logger.info({ renderId, outputUrl }, 'Remotion Lambda (Motion): render complete')
  return outputUrl
}

/**
 * Renders an F2 Motion Design video (MotionComposition pipeline) via AWS Lambda.
 * Uses MotionDesign-* compositions registered in Root.tsx — same component
 * tree as the local renderer for visual parity.
 *
 * Returns the S3 output URL.
 */
export async function renderMotionDesignVideoLambda(
  options: RenderMotionDesignOptions,
): Promise<string> {
  const { renderMediaOnLambda } = await import('@remotion/lambda/client')

  const { scenes, format, voiceoverBuffer, musicUrl } = options

  const formatKey = (format in MOTION_DESIGN_FORMAT_MAP ? format : '16_9') as '16_9' | '9_16' | '1_1'
  const { compositionId, width, height } = MOTION_DESIGN_FORMAT_MAP[formatKey]

  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!
  const serveUrl     = process.env.REMOTION_LAMBDA_SERVE_URL!
  const region       = (process.env.AWS_REGION ?? 'eu-west-3') as Parameters<typeof renderMediaOnLambda>[0]['region']

  // F2 scenes come pre-quantized in frames (`duration` field is the frame count).
  const durationInFrames = Math.max(
    FPS,
    scenes.reduce((sum, s) => sum + Math.max(1, s.duration), 0),
  )

  let audioUrl: string | undefined
  if (voiceoverBuffer && voiceoverBuffer.length > 0) {
    audioUrl = `data:audio/mpeg;base64,${voiceoverBuffer.toString('base64')}`
  }

  const inputProps: MotionCompositionProps = {
    scenes,
    format: formatKey,
    audioUrl,
    musicUrl,
  }

  logger.info(
    { compositionId, functionName, region, sceneCount: scenes.length, durationInFrames },
    'Remotion Lambda (MotionDesign): starting render'
  )

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: compositionId,
    inputProps: inputProps as unknown as Record<string, unknown>,
    codec: 'h264',
    framesPerLambda: 999,
    concurrencyPerLambda: 1,
    forceWidth: width,
    forceHeight: height,
    forceDurationInFrames: durationInFrames,
  })

  const outputUrl = await pollLambdaRender({
    renderId, bucketName, functionName, region: region as string,
    videoLabel: `motion-design:${compositionId}`,
  })

  logger.info({ renderId, outputUrl }, 'Remotion Lambda (MotionDesign): render complete')
  return outputUrl
}

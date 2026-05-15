/**
 * CLYRO — Remotion Lambda Service
 *
 * Cloud rendering via AWS Lambda. Activé quand USE_REMOTION_LAMBDA=true
 * dans l'environnement (et que les credentials AWS sont présents).
 *
 * Setup requis (une seule fois par région AWS) :
 *   npx remotion lambda policies validate
 *   npx remotion lambda functions deploy --memory=3008 --timeout=240 --disk=2048
 *   npx remotion lambda sites create apps/api/src/remotion/Root.tsx --site-name=clyro-motion
 *
 * Variables d'env nécessaires (à définir sur clyro-worker dans Render) :
 *   USE_REMOTION_LAMBDA=true
 *   AWS_REGION (ex: eu-central-1)
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   REMOTION_LAMBDA_FUNCTION_NAME (ex: remotion-render-4-0-448-mem3008mb-disk2048mb-240sec)
 *   REMOTION_LAMBDA_SERVE_URL     (ex: https://xxxxx.s3.eu-central-1.amazonaws.com/sites/clyro-motion/index.html)
 *
 * Optionnel :
 *   REMOTION_FRAMES_PER_LAMBDA (default 100) — control la parallélisation.
 *     Plus petit = plus de Lambdas en parallèle = rendu plus rapide.
 *     Plus grand = moins de Lambdas = moins de risques de hit le quota
 *     "concurrent executions" (défaut AWS = 1000/région).
 *
 * Re-exécuter `lambda sites create` après chaque modification des composants
 * dans packages/video/src/ (sinon le serve URL pointe sur l'ancien bundle).
 */

import { spawn } from 'child_process'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger'
import type { RenderMotionVideoOptions, RenderMotionVideoResult, RenderMotionDesignOptions } from './remotion'
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
// (lines DynamicMotion-{16-9|9-16|1-1}). Visual parity with local renderer
// depends on identical compositionId here and in services/remotion.ts.
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

/**
 * Number of frames each Lambda function renders. The full video is split
 * into chunks of this size and N Lambdas run in parallel.
 *
 * Trade-off:
 *   • Lower (~50-100) → more Lambdas in parallel, faster wall-time, but
 *     uses more concurrent executions (AWS default quota: 1000/region)
 *   • Higher (200-500) → fewer Lambdas, less parallel, slower but safer
 *     for accounts with low quotas
 *
 * Default 100 means a 30 s video at 30 fps (= 900 frames) fans out across
 * 9 Lambdas → ~30 s wall-time vs ~3 min if rendered as a single chunk.
 *
 * Override via REMOTION_FRAMES_PER_LAMBDA env var if your AWS quota is
 * limited (set to 999 to effectively disable parallelization).
 */
function getFramesPerLambda(): number {
  const fromEnv = process.env.REMOTION_FRAMES_PER_LAMBDA
  if (fromEnv) {
    const n = parseInt(fromEnv, 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 100
}

// ── Cost helper ──────────────────────────────────────────────────────────
type RenderCostsLike = { accruedSoFar?: number; displayCost?: string; currency?: string } | undefined
function summarizeCosts(costs: RenderCostsLike): { displayCost?: string; accrued?: number } {
  if (!costs) return {}
  return {
    displayCost: costs.displayCost,
    accrued:     typeof costs.accruedSoFar === 'number' ? Math.round(costs.accruedSoFar * 10000) / 10000 : undefined,
  }
}

// ── Polling helper ───────────────────────────────────────────────────────
/**
 * Polls a Lambda render until completion. Returns the final S3 outputUrl + cost.
 * Throws on fatal errors.
 */
async function pollLambdaRender(args: {
  renderId:     string
  bucketName:   string
  functionName: string
  region:       string
  videoLabel:   string
}): Promise<{ outputUrl: string; costs: RenderCostsLike }> {
  const { getRenderProgress } = await import('@remotion/lambda/client')
  const { renderId, bucketName, functionName, region, videoLabel } = args

  let outputUrl = ''
  let costs: RenderCostsLike
  let done = false
  let lastLoggedPct = -10

  while (!done) {
    await new Promise((r) => setTimeout(r, 3000))
    const progress = await getRenderProgress({
      renderId, bucketName, functionName,
      region: region as Parameters<typeof getRenderProgress>[0]['region'],
    })

    const pct = Math.round(progress.overallProgress * 100)
    // Log every 10 % progression delta to avoid log spam every 3 s.
    if (pct - lastLoggedPct >= 10) {
      logger.info(
        { progress: pct, label: videoLabel, costs: summarizeCosts(progress.costs as RenderCostsLike) },
        'Lambda render progress'
      )
      lastLoggedPct = pct
    }

    if (progress.done) {
      outputUrl = progress.outputFile ?? ''
      costs = progress.costs as RenderCostsLike
      done = true
    } else if (progress.fatalErrorEncountered) {
      throw new Error(`Lambda render failed (${videoLabel}): ${progress.errors?.[0]?.message ?? 'unknown error'}`)
    }
  }

  return { outputUrl, costs }
}

// ── S3 download helper ───────────────────────────────────────────────────
/**
 * Downloads the Remotion-rendered MP4 from its S3 output URL into a Buffer.
 * The URL is a public S3 URL set up by Remotion at render time.
 *
 * This step is what makes Lambda + local storage parity possible — instead
 * of returning a public S3 link (which would persist on Remotion's bucket
 * and bypass our Supabase retention rules), we download the MP4 and re-upload
 * it to Supabase Storage from the pipeline. Single source of truth.
 */
async function downloadRenderOutput(outputUrl: string): Promise<Buffer> {
  if (!outputUrl) throw new Error('Lambda returned no output URL')
  // 5 min timeout — Lambda finishes the render before the URL is published,
  // so the download itself should be near-instant on a 50-100 MB video.
  // 300 s leaves headroom for slow S3 region-to-region transfers.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300_000)
  try {
    const res = await fetch(outputUrl, { signal: controller.signal })
    if (!res.ok) throw new Error(`S3 download failed (${res.status}): ${outputUrl.slice(0, 120)}`)
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`S3 download timed out after 5 min: ${outputUrl.slice(0, 120)}`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

// ── Thumbnail capture (ffmpeg) ───────────────────────────────────────────
/**
 * Captures a still PNG at the given second of a downloaded MP4 buffer.
 * Returns null on any error (thumbnail is non-critical, never blocks).
 *
 * Uses ffmpeg via spawn — same toolchain as the rest of the pipeline.
 * Avoids the cost of an extra Lambda invocation (renderStillOnLambda)
 * since we already have the MP4 in memory after the main render.
 */
async function captureThumbnailFromBuffer(mp4: Buffer, atSeconds = 3): Promise<Buffer | null> {
  const workDir = join(tmpdir(), `clyro-lambda-thumb-${randomUUID()}`)
  const inPath  = join(workDir, 'input.mp4')
  const outPath = join(workDir, 'thumb.png')

  try {
    await mkdir(workDir, { recursive: true })
    await writeFile(inPath, mp4)

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-ss', String(atSeconds),
        '-i', inPath,
        '-vframes', '1',
        '-q:v', '2',  // PNG quality (1=best, 31=worst); 2 is near-lossless for thumbnails
        '-y',
        outPath,
      ], { stdio: ['ignore', 'ignore', 'pipe'] })
      proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)))
      proc.on('error', reject)
    })

    return await readFile(outPath)
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Lambda: thumbnail capture failed — continuing without')
    return null
  } finally {
    await unlink(inPath).catch(() => null)
    await unlink(outPath).catch(() => null)
  }
}

// ── Image inlining helper ────────────────────────────────────────────────
/** Common helper to inline scene images as base64 data URLs. Lambda's serve
 *  URL bundle can't cross-origin-fetch arbitrary URLs at render time without
 *  CORS hassle — embedding the bytes is the simplest way to guarantee the
 *  images render. */
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

// ── Motion (legacy DynamicComposition pipeline) ──────────────────────────
/**
 * Renders a Motion video via AWS Lambda, downloads the MP4 + captures a
 * thumbnail, returns both as Buffers. Same signature as renderMotionVideo
 * (the local Chromium renderer) so callers can use a single code path.
 */
export async function renderMotionVideoLambda(
  options: RenderMotionVideoOptions,
): Promise<RenderMotionVideoResult> {
  const { renderMediaOnLambda } = await import('@remotion/lambda/client')

  const { scenes, brandConfig, format, voiceoverBuffer, musicBuffer } = options

  const formatKey = (format in MOTION_FORMAT_MAP ? format : '16:9') as '9:16' | '1:1' | '16:9'
  const { compositionId, width, height } = MOTION_FORMAT_MAP[formatKey]

  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!
  const serveUrl     = process.env.REMOTION_LAMBDA_SERVE_URL!
  const region       = (process.env.AWS_REGION ?? 'eu-central-1') as Parameters<typeof renderMediaOnLambda>[0]['region']
  const framesPerLambda = getFramesPerLambda()

  const durationInFrames = Math.max(
    FPS,
    scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.duree_estimee * FPS)), 0),
  )

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
    {
      compositionId, functionName, region, sceneCount: scenes.length,
      durationInFrames, framesPerLambda,
      estimatedLambdas: Math.ceil(durationInFrames / framesPerLambda),
    },
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
    framesPerLambda,
    concurrencyPerLambda: 1,
    forceWidth: width,
    forceHeight: height,
    forceDurationInFrames: durationInFrames,
  })

  const { outputUrl, costs } = await pollLambdaRender({
    renderId, bucketName, functionName, region: region as string,
    videoLabel: `motion:${compositionId}`,
  })

  // Download from S3 and capture thumbnail in parallel — saves ~3 s wall-time
  // on a typical Motion video where each step takes ~2-5 s.
  const mp4 = await downloadRenderOutput(outputUrl)
  const thumbnail = await captureThumbnailFromBuffer(mp4, 3)

  logger.info(
    {
      renderId, mp4Bytes: mp4.length, hasThumbnail: !!thumbnail,
      costs: summarizeCosts(costs),
    },
    'Remotion Lambda (Motion): render complete + downloaded'
  )

  return { mp4, thumbnail }
}

// ── F2 MotionDesign (MotionComposition pipeline) ─────────────────────────
/**
 * Renders an F2 Motion Design video via AWS Lambda. Same return shape as
 * the local renderer (RenderMotionVideoResult) for code-path uniformity.
 */
export async function renderMotionDesignVideoLambda(
  options: RenderMotionDesignOptions,
): Promise<RenderMotionVideoResult> {
  const { renderMediaOnLambda } = await import('@remotion/lambda/client')

  const { scenes, format, voiceoverBuffer, musicUrl, brand } = options

  const formatKey = (format in MOTION_DESIGN_FORMAT_MAP ? format : '16_9') as '16_9' | '9_16' | '1_1'
  const { compositionId, width, height } = MOTION_DESIGN_FORMAT_MAP[formatKey]

  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!
  const serveUrl     = process.env.REMOTION_LAMBDA_SERVE_URL!
  const region       = (process.env.AWS_REGION ?? 'eu-central-1') as Parameters<typeof renderMediaOnLambda>[0]['region']
  const framesPerLambda = getFramesPerLambda()

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
    brand,
  }

  logger.info(
    {
      compositionId, functionName, region, sceneCount: scenes.length,
      durationInFrames, framesPerLambda,
      estimatedLambdas: Math.ceil(durationInFrames / framesPerLambda),
    },
    'Remotion Lambda (MotionDesign): starting render'
  )

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: compositionId,
    inputProps: inputProps as unknown as Record<string, unknown>,
    codec: 'h264',
    framesPerLambda,
    concurrencyPerLambda: 1,
    forceWidth: width,
    forceHeight: height,
    forceDurationInFrames: durationInFrames,
  })

  const { outputUrl, costs } = await pollLambdaRender({
    renderId, bucketName, functionName, region: region as string,
    videoLabel: `motion-design:${compositionId}`,
  })

  const mp4 = await downloadRenderOutput(outputUrl)
  const thumbnail = await captureThumbnailFromBuffer(mp4, 3)

  logger.info(
    {
      renderId, mp4Bytes: mp4.length, hasThumbnail: !!thumbnail,
      costs: summarizeCosts(costs),
    },
    'Remotion Lambda (MotionDesign): render complete + downloaded'
  )

  return { mp4, thumbnail }
}

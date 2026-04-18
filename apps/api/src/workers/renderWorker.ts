/**
 * CLYRO Render Worker
 * Process séparé qui consomme la queue BullMQ pour les rendus vidéo.
 *
 * Démarrage local :  npx ts-node src/workers/renderWorker.ts
 * Sur Render       :  créer un "Background Worker" avec la même image Docker
 *                     et la commande : node dist/workers/renderWorker.js
 *
 * Objectifs de robustesse (évite les alertes "Exited with status 1" sur Render) :
 *   - REDIS_URL manquant      → mode idle avec rappel toutes les 60 s
 *   - Env Supabase/AI manquant → mode idle, on ne tente pas d'importer les pipelines
 *   - Unhandled rejection     → log + Sentry, on ne quitte PAS (BullMQ retry la job)
 *   - Redis down temporaire   → retryStrategy côté ioredis, pas d'exit
 *   - SIGTERM/SIGINT          → graceful shutdown (exit 0)
 */

import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

import * as Sentry from '@sentry/node'
import type { Worker as WorkerType, Job as JobType } from 'bullmq'
import { logger } from '../lib/logger'

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' })
}

// ── Global safety net ─────────────────────────────────────────────────────
// IMPORTANT : ne pas exit(1). BullMQ marque la job en failed et la retry
// automatiquement. Un worker qui crash sur chaque rejection spammerait
// les alertes Render et ralentirait la queue.
process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason)
  logger.error({ reason }, 'Unhandled rejection in render worker (kept alive)')
})
process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
  logger.error({ err }, 'Uncaught exception in render worker (kept alive)')
})

// ── Idle mode : garde le process vivant sans crasher ──────────────────────
// Utilisé quand on ne peut pas démarrer le worker (env manquante) — Render
// verra le service comme "running" au lieu de le restart en boucle.
//
// setInterval SANS .unref() → garde l'event loop vivant.
// Le await sur la promise jamais résolue suspend main() indéfiniment.
function idleForever(reason: string): Promise<never> {
  logger.error({ reason }, 'Render worker idling — service is deployed but not consuming jobs')
  const remind = () => logger.warn({ reason }, 'Render worker still idle — fix the env/config and redeploy')
  setInterval(remind, 60_000)
  return new Promise<never>(() => { /* never resolves */ })
}

async function main(): Promise<void> {
  // ── 1. Redis check ──────────────────────────────────────────────────────
  if (!process.env.REDIS_URL) {
    await idleForever('REDIS_URL is not set — cannot consume BullMQ queue')
  }

  // ── 2. Env vars required by downstream pipelines ────────────────────────
  // Importing pipelines eagerly crashes the process if Supabase env is missing
  // (supabaseAdmin throws at module load). On vérifie d'abord, puis on importe.
  const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = requiredEnv.filter((k) => !process.env[k])
  if (missing.length > 0) {
    await idleForever(`Missing required env vars on worker: ${missing.join(', ')}`)
  }

  // ── 3. Dynamic import — any import error keeps us alive (idle) ──────────
  let redisConnection: import('ioredis').default | null
  let RENDER_QUEUE_NAME: string
  let WorkerCtor: typeof import('bullmq').Worker
  let runMotionPipeline: typeof import('../pipelines/motion').runMotionPipeline
  let runFacelessPipeline: typeof import('../pipelines/faceless').runFacelessPipeline

  try {
    const queueMod = await import('../queues/renderQueue')
    redisConnection = queueMod.redisConnection
    RENDER_QUEUE_NAME = queueMod.RENDER_QUEUE_NAME
    const bullmq = await import('bullmq')
    WorkerCtor = bullmq.Worker
    const motionMod = await import('../pipelines/motion')
    runMotionPipeline = motionMod.runMotionPipeline
    const facelessMod = await import('../pipelines/faceless')
    runFacelessPipeline = facelessMod.runFacelessPipeline
  } catch (err) {
    Sentry.captureException(err)
    logger.error({ err }, 'Failed to load worker modules (likely missing env var or broken import)')
    await idleForever('worker module import failed — see previous log entry')
  }

  if (!redisConnection!) {
    await idleForever('Redis connection object is null despite REDIS_URL being set')
  }

  // ── 4. Start the BullMQ worker ──────────────────────────────────────────
  type RenderJobData = import('../queues/renderQueue').MotionJobData
                     | import('../queues/renderQueue').FacelessJobData

  const worker: WorkerType<RenderJobData> = new WorkerCtor!<RenderJobData>(
    RENDER_QUEUE_NAME!,
    async (job: JobType<RenderJobData>) => {
      logger.info({ jobId: job.id, type: job.data.type }, 'Render job started')

      if (job.data.type === 'motion') {
        await runMotionPipeline!(job.data)
      } else if (job.data.type === 'faceless') {
        await runFacelessPipeline!(job.data)
      } else {
        throw new Error(`Unknown job type: ${(job.data as { type: string }).type}`)
      }

      logger.info({ jobId: job.id }, 'Render job completed')
    },
    {
      connection: redisConnection!,
      // Concurrence 1 : chaque job faceless consomme ~1.5 GB (Chrome x3 + bundle
      // Remotion + buffers MP3/MP4 + FFmpeg). Lancer 2 jobs en parallèle
      // faisait dépasser la limite mémoire Render et déclenchait un restart.
      // À 1, on serialise — la queue progresse plus lentement mais sans OOM.
      concurrency: 1,
      // Faceless + Remotion pipelines peuvent dépasser 30 min sur les longues
      // vidéos (60+ scènes, rate-limit ElevenLabs + FFmpeg single-thread).
      // lockDuration doit rester au-dessus du PIPELINE_TIMEOUT_MS (45 min par
      // défaut) sinon BullMQ pense le worker mort et re-queue le job — double
      // consommation crédits + collision d'upload Supabase.
      lockDuration:    60 * 60 * 1000, // 60 min
      lockRenewTime:    5 * 60 * 1000, // renew lock every 5 min
    },
  )

  worker.on('failed', (job, err) => {
    Sentry.captureException(err, { extra: { jobId: job?.id, jobData: job?.data } })
    logger.error({ err, jobId: job?.id }, 'Render job failed')
  })

  worker.on('error', (err) => {
    Sentry.captureException(err)
    logger.error({ err }, 'BullMQ worker error (kept alive)')
  })

  worker.on('ready', () => {
    logger.info('BullMQ worker ready — connected to Redis and listening for jobs')
  })

  logger.info({ concurrency: 1 }, 'CLYRO Render Worker started, waiting for jobs...')

  // ── 5. Graceful shutdown ────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down render worker...')
    try {
      await worker.close()
    } catch (err) {
      logger.error({ err }, 'Error during worker.close()')
    }
    process.exit(0)
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch(async (err) => {
  Sentry.captureException(err)
  logger.error({ err }, 'Fatal error in render worker main()')
  await idleForever('worker main() threw — see previous log entry')
})

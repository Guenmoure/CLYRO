/**
 * CLYRO Render Worker
 * Process séparé qui consomme la queue BullMQ pour les rendus vidéo.
 *
 * Démarrage local :  npx ts-node src/workers/renderWorker.ts
 * Sur Render       :  créer un "Background Worker" avec la même image Docker
 *                     et la commande : node dist/workers/renderWorker.js
 */

import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

import * as Sentry from '@sentry/node'
import { Worker, Job } from 'bullmq'
import { logger } from '../lib/logger'
import { redisConnection, RENDER_QUEUE_NAME, type RenderJobData } from '../queues/renderQueue'
import { runMotionPipeline } from '../pipelines/motion'
import { runFacelessPipeline } from '../pipelines/faceless'

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' })
}

if (!redisConnection) {
  logger.error('Redis unavailable — render worker cannot start (REDIS_URL not set?)')
  process.exit(1)
}

// Catch-all for unhandled rejections / exceptions so we get a proper log entry
// before the process exits. Render will restart us automatically.
process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason)
  logger.error({ reason }, 'Unhandled rejection in render worker — exiting')
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
  logger.error({ err }, 'Uncaught exception in render worker — exiting')
  process.exit(1)
})

const worker = new Worker<RenderJobData>(
  RENDER_QUEUE_NAME,
  async (job: Job<RenderJobData>) => {
    logger.info({ jobId: job.id, type: job.data.type }, 'Render job started')

    if (job.data.type === 'motion') {
      await runMotionPipeline(job.data)
    } else if (job.data.type === 'faceless') {
      await runFacelessPipeline(job.data)
    } else {
      throw new Error(`Unknown job type: ${(job.data as { type: string }).type}`)
    }

    logger.info({ jobId: job.id }, 'Render job completed')
  },
  {
    connection: redisConnection,
    concurrency: 2,
    // Faceless + Remotion pipelines can take up to 30 min.
    // lockDuration must exceed that or BullMQ will re-queue the job mid-flight.
    lockDuration:    35 * 60 * 1000, // 35 min
    lockRenewTime:    5 * 60 * 1000, // renew lock every 5 min
  }
)

worker.on('failed', (job, err) => {
  Sentry.captureException(err, { extra: { jobId: job?.id, jobData: job?.data } })
  logger.error({ err, jobId: job?.id }, 'Render job failed')
})

worker.on('error', (err) => {
  Sentry.captureException(err)
  logger.error({ err }, 'BullMQ worker error')
})

logger.info({ concurrency: 2 }, 'CLYRO Render Worker started, waiting for jobs...')

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down render worker...')
  await worker.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

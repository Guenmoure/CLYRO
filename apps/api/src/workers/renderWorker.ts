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
  logger.error('Redis unavailable — render worker cannot start')
  process.exit(1)
}

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
    concurrency: 2, // max 2 rendus simultanés par worker
    lockDuration: 10 * 60 * 1000, // 10 min — un render peut prendre du temps
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

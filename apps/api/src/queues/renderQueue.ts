import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { logger } from '../lib/logger'

export const RENDER_QUEUE_NAME = 'render'

// ── Redis connection ──────────────────────────────────────────────────────
// En local, Redis doit tourner sur 127.0.0.1:6379
// Sur Render, utiliser REDIS_URL (ex: redis://red-xxxxx.onrender.com:6379)
function createRedisConnection(): IORedis | null {
  const url = process.env.REDIS_URL
  if (!url) {
    logger.info('REDIS_URL not set — queue disabled, using inline execution')
    return null
  }
  try {
    const conn = new IORedis(url, {
      maxRetriesPerRequest: null, // requis par BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times >= 3) return null  // Stop retrying after 3 attempts
        return Math.min(times * 500, 2000)
      },
    })
    let warnedOnce = false
    conn.on('error', () => {
      if (!warnedOnce) {
        warnedOnce = true
        logger.warn('Redis unavailable — queue disabled, falling back to inline execution')
      }
    })
    conn.connect().catch(() => { /* handled by error event */ })
    return conn
  } catch {
    return null
  }
}

export const redisConnection = createRedisConnection()

// ── Job payloads ──────────────────────────────────────────────────────────

export interface MotionJobData {
  type: 'motion'
  videoId: string
  userId: string
  userEmail: string
  title: string
  brief: string
  /** Optional voiceover script. When provided + duration='auto', the motion
   *  pipeline scales scene count to the word count so the script is preserved. */
  script?: string
  style: string
  format: string
  duration: string
  brandConfig: {
    primary_color: string
    secondary_color?: string
    font_family?: string
    logo_url?: string
  }
  voiceId: string
  musicTrackUrl?: string
}

export interface FacelessJobData {
  type: 'faceless'
  videoId: string
  userId: string
  userEmail: string
  title: string
  style: string
  format: string
  duration: string
  script: string
  voiceId: string
}

export type RenderJobData = MotionJobData | FacelessJobData

// ── Queue instance (null si Redis indisponible) ───────────────────────────
export let renderQueue: Queue<RenderJobData> | null = null

export function isRedisReady(): boolean {
  return redisConnection?.status === 'ready'
}

if (redisConnection) {
  renderQueue = new Queue<RenderJobData>(RENDER_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })
  logger.info('BullMQ render queue initialized')
}

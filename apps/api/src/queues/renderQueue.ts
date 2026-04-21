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
      // Retry indefinitely with capped exponential backoff (1s → 30s).
      // Stopping too early (old: 3 attempts) caused the worker to run in a
      // broken state after a Redis hiccup and crash with unhandled errors.
      retryStrategy: (times) => Math.min(times * 1000, 30_000),
      connectTimeout: 10_000,
    })
    let warnedOnce = false
    conn.on('error', (err: Error) => {
      if (!warnedOnce) {
        warnedOnce = true
        logger.warn({ msg: err.message }, 'Redis connection error — will retry in background')
      }
    })
    conn.on('ready', () => {
      warnedOnce = false
      logger.info('Redis connection ready')
    })
    // 'end' is not terminal: IORedis retryStrategy will reconnect.
    // Surfacing it as a warning (not exiting) lets the worker survive
    // transient Redis outages without spamming Render "Exited status 1" alerts.
    conn.on('end', () => {
      logger.warn('Redis connection ended — ioredis will attempt reconnection')
    })
    conn.connect().catch(() => { /* handled by error event + retryStrategy */ })
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

export interface MotionDesignJobData {
  type: 'motion_design'
  videoId:   string
  userId:    string
  userEmail: string
  title:     string
  brief:     string
  format:    '16_9' | '9_16' | '1_1'
  duration:  string
  brandConfig: {
    primary_color:   string
    secondary_color?: string
    logo_url?:        string
  }
  voiceId?:  string
  musicUrl?: string
}

export type RenderJobData = MotionJobData | FacelessJobData | MotionDesignJobData

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

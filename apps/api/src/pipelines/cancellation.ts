/**
 * Pipeline cancellation cooperation.
 *
 * POST /api/v1/videos/:id/cancel (routes/videos.ts) marks a video row
 * as status='cancelled' and refunds the credits. If the BullMQ job was
 * still waiting, it is removed from the queue. If it was already
 * ACTIVE, the running pipeline must cooperate: it calls
 * assertNotCancelled() between its major steps and aborts with a
 * CancelledError as soon as it observes the cancelled status.
 *
 * CancelledError extends BullMQ's UnrecoverableError so that — should
 * it ever escape a pipeline's catch block — the worker fails the job
 * WITHOUT consuming the remaining `attempts` retries (a cancelled
 * video must never be silently re-rendered). In practice every
 * pipeline catches it, logs, and returns early: no 'error' status, no
 * refund (the cancel route already issued the idempotent refund — see
 * migration 20260610000000_idempotent_refunds.sql).
 */

import { UnrecoverableError } from 'bullmq'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export class CancelledError extends UnrecoverableError {
  readonly videoId: string

  constructor(videoId: string) {
    super(`Video ${videoId} was cancelled by the user`)
    this.videoId = videoId
    // Keep the prototype chain intact when targeting ES5-ish outputs.
    Object.setPrototypeOf(this, CancelledError.prototype)
  }
}

/**
 * Returns true when the video row exists and has status='cancelled'.
 * Read errors are treated as "not cancelled" — a transient DB hiccup
 * must not kill a healthy pipeline run.
 */
export async function isCancelled(videoId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('videos')
    .select('status')
    .eq('id', videoId)
    .maybeSingle()

  if (error) {
    logger.warn({ err: error, videoId }, 'isCancelled: status read failed — assuming not cancelled')
    return false
  }
  return data?.status === 'cancelled'
}

/**
 * Throws CancelledError when the user cancelled this video. Call this
 * at pipeline start and between expensive steps (after script, after
 * audio, after images/clips, before render) so a cancellation stops
 * upstream spend as early as possible.
 */
export async function assertNotCancelled(videoId: string): Promise<void> {
  if (await isCancelled(videoId)) {
    throw new CancelledError(videoId)
  }
}

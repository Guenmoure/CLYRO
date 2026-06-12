/**
 * Motion auto-router
 *
 * Single entry point for the Motion product. The HTTP route enqueues a
 * `motion_auto` job WITHOUT deciding which engine to use. This router runs
 * as step 0 inside the worker:
 *   1. Claude classifies the brief → "graphics" or "design".
 *   2. `videos.module` is updated to the resolved engine.
 *   3. The job is delegated to the existing pipeline, unchanged.
 *
 * Why the worker and not the route: classification is a billable Claude call
 * (~1-2 s). Running it in the route would block the 202 response. Here it is
 * invisible to HTTP latency.
 *
 * The two downstream pipelines are NOT modified — this file only picks one
 * and adapts the param shape (notably the '16:9' ↔ '16_9' format mismatch).
 */
import * as Sentry from '@sentry/node'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { refundCredits } from '../services/credits'
import { classifyMotionBrief } from '../services/claude'
import { runMotionPipeline } from './motion'
import { runMotionDesignPipeline } from './motion-design'
import { isCancelled } from './cancellation'
import type { MotionAutoJobData } from '../queues/renderQueue'

/** Motion Design's Remotion compositions are keyed by the underscore form. */
function toUnderscoreFormat(format: string): '16_9' | '9_16' | '1_1' {
  switch (format) {
    case '9:16':
    case '9_16':
      return '9_16'
    case '1:1':
    case '1_1':
      return '1_1'
    default:
      return '16_9'
  }
}

const MOTION_DESIGN_STYLES = ['corporate', 'dynamique', 'luxe', 'fun'] as const
type MotionDesignStyle = (typeof MOTION_DESIGN_STYLES)[number]

/** Both engines share the same 4 visual registers; narrow the loose string. */
function toMotionDesignStyle(style: string): MotionDesignStyle | undefined {
  return (MOTION_DESIGN_STYLES as readonly string[]).includes(style)
    ? (style as MotionDesignStyle)
    : undefined
}

export async function runMotionAuto(job: MotionAutoJobData): Promise<void> {
  const { videoId, userId, brief, script } = job

  // Annulé avant le pickup du worker ? Stop avant la classification Claude
  // (appel facturable). Le refund a déjà été émis par la route /cancel.
  if (await isCancelled(videoId)) {
    logger.info({ videoId }, 'Motion auto-router skipped — video cancelled by user')
    return
  }

  // ── Step 0 — classify ────────────────────────────────────────────────────
  // Surface a transient "classifying" phase so the progress UI shows motion
  // is alive. The delegated pipeline overwrites metadata on its first status
  // update, so this is purely cosmetic for the first ~2 s.
  await supabaseAdmin
    .from('videos')
    .update({ status: 'generating', metadata: { phase: 'classifying', progress: 3 } })
    .eq('id', videoId)
    // Never resurrect a row the user just cancelled (race with /cancel).
    .neq('status', 'cancelled')
    .then(() => null, () => null)

  let render: 'graphics' | 'design' = 'design'
  try {
    const classification = await classifyMotionBrief(brief, script)
    render = classification.render
    logger.info({ videoId, render, reason: classification.reason }, 'Motion auto-router decision')
  } catch (err) {
    // classifyMotionBrief already retries + falls back internally, so this
    // catch is defensive only. Default to design (no fal.ai image spend).
    Sentry.captureException(err, { extra: { videoId, stage: 'motion-router-classify' } })
    logger.error({ err, videoId }, 'Motion auto-router classification threw — defaulting to design')
  }

  // ── Step 1 — persist the resolved engine ─────────────────────────────────
  // The route inserted a provisional module; correct it so the dashboard and
  // status badges label the video accurately.
  const resolvedModule = render === 'graphics' ? 'motion' : 'motion_design'
  await supabaseAdmin
    .from('videos')
    .update({ module: resolvedModule })
    .eq('id', videoId)
    .then(() => null, () => null)

  // ── Step 2 — delegate ────────────────────────────────────────────────────
  try {
    if (render === 'graphics') {
      // Motion Graphics expects the colon format form as-is. brandKitId
      // est passé pour le suivi métier mais Motion Graphics ne consomme
      // pas encore le DNA enrichi (Phase 2+).
      await runMotionPipeline({
        videoId:       job.videoId,
        userId:        job.userId,
        userEmail:     job.userEmail,
        title:         job.title,
        brief:         job.brief,
        script:        job.script,
        style:         job.style,
        format:        job.format,
        duration:      job.duration,
        brandConfig:   job.brandConfig,
        voiceId:       job.voiceId,
        musicTrackUrl: job.musicTrackUrl,
        creditCost:    job.creditCost,
      })
      return
    }

    // render === 'design' — Motion Design needs the underscore format form
    // and a narrowed style enum. `script` is intentionally NOT forwarded:
    // the design pipeline derives narration from the brief only.
    // brandKitId est forwardé : Motion Design fetch le kit et enrichit le
    // prompt Claude avec le DNA (tagline, valeurs, ton, esthétique).
    await runMotionDesignPipeline({
      videoId:    job.videoId,
      userId:     job.userId,
      userEmail:  job.userEmail,
      title:      job.title,
      brief:      job.brief,
      format:     toUnderscoreFormat(job.format),
      duration:   job.duration,
      style:      toMotionDesignStyle(job.style),
      brandConfig: {
        primary_color:   job.brandConfig.primary_color,
        secondary_color: job.brandConfig.secondary_color,
        logo_url:        job.brandConfig.logo_url,
        font_family:     job.brandConfig.font_family,
      },
      voiceId:    job.voiceId || undefined,
      musicUrl:   job.musicTrackUrl,
      creditCost: job.creditCost,
      brandKitId: job.brandKitId,
    })
  } catch (err) {
    // Both pipelines already mark the row as 'error' + refund on their own
    // internal failures. This catch covers a throw BEFORE the delegated
    // pipeline took ownership (e.g. a synchronous param error here) — in
    // that case nothing downstream marked the video as failed, so we do it.
    const errorMessage = err instanceof Error ? err.message : String(err)
    Sentry.captureException(err, { extra: { videoId, userId, stage: 'motion-router-delegate' } })
    logger.error({ err, videoId }, 'Motion auto-router delegation failed')

    const { data: existingVideo } = await supabaseAdmin
      .from('videos')
      .select('status, metadata')
      .eq('id', videoId)
      .single()
      .then((r) => r, () => ({ data: null }))

    // Only act if the delegated pipeline didn't already record the failure.
    if (existingVideo && existingVideo.status !== 'error') {
      const existingMeta = (existingVideo.metadata ?? {}) as Record<string, unknown>
      await supabaseAdmin
        .from('videos')
        .update({
          status: 'error',
          metadata: { ...existingMeta, error_message: errorMessage, progress: 0, error_at: new Date().toISOString() },
        })
        .eq('id', videoId)
        .then(() => null, () => null)

      if (job.creditCost && job.creditCost > 0) {
        await refundCredits(userId, job.creditCost, `video:${videoId}`, { reason: 'motion_router_error' })
          .catch((refErr) => logger.warn({ err: refErr, userId, videoId }, 'Motion router refund failed (non-blocking)'))
      }
    }
    throw err
  }
}

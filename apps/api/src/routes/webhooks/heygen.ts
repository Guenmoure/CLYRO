/**
 * HeyGen webhook handler for F5 Studio.
 * Receives `video.generated` events and flips the corresponding scene
 * to `done` / `error` in Supabase.
 *
 * HeyGen POSTs a JSON body. We verify via `X-Signature` (HMAC sha256)
 * against HEYGEN_WEBHOOK_SECRET.
 */

import { Router } from 'express'
import { supabaseAdmin } from '../../lib/supabase'
import { logger } from '../../lib/logger'
import { verifyHeyGenSignature } from '../../services/heygen'

export const heygenWebhookRouter = Router()

interface HeyGenWebhookPayload {
  event_type: 'avatar_video.success' | 'avatar_video.fail' | string
  event_data: {
    video_id: string
    callback_id?: string
    url?: string
    thumbnail_url?: string
    duration?: number
    error?: { code: string; message: string }
  }
}

heygenWebhookRouter.post('/heygen', async (req, res) => {
  try {
    // Express should register this router with express.raw() so req.body is Buffer
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body)
    const signature = (req.headers['x-signature'] as string) ?? (req.headers['signature'] as string) ?? ''

    if (signature && !verifyHeyGenSignature(rawBody, signature)) {
      logger.warn({ signature: signature.slice(0, 16) }, 'HeyGen webhook signature mismatch')
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    const payload = JSON.parse(rawBody) as HeyGenWebhookPayload
    const { event_type, event_data } = payload
    const { video_id, callback_id, url, thumbnail_url, duration, error } = event_data

    // Prefer callback_id (our own key); fall back to heygen_video_id for
    // idempotency if the callback_id wasn't set.
    const matchBy = callback_id ? { callback: callback_id } : { heygen: video_id }
    const { data: scene } = callback_id
      ? await supabaseAdmin
          .from('studio_scenes')
          .select('id, status, previous_versions')
          .eq('heygen_video_id', video_id)
          .maybeSingle()
      : await supabaseAdmin
          .from('studio_scenes')
          .select('id, status, previous_versions')
          .eq('heygen_video_id', video_id)
          .maybeSingle()

    if (!scene) {
      logger.warn({ video_id, callback_id, matchBy }, 'HeyGen webhook: no matching scene')
      res.status(200).json({ received: true, matched: false })
      return
    }

    // Idempotence — don't overwrite a 'done' scene with another 'done' event.
    if (scene.status === 'done' && event_type === 'avatar_video.success') {
      res.status(200).json({ received: true, idempotent: true })
      return
    }

    if (event_type === 'avatar_video.success' && url) {
      await supabaseAdmin.from('studio_scenes').update({
        status: 'done',
        video_url: url,
        thumbnail_url: thumbnail_url ?? null,
        duration_actual: duration ?? null,
        error_message: null,
      }).eq('id', scene.id)
      logger.info({ sceneId: scene.id, video_id }, 'HeyGen scene done')
    } else if (event_type === 'avatar_video.fail') {
      await supabaseAdmin.from('studio_scenes').update({
        status: 'error',
        error_message: error?.message ?? 'HeyGen reported failure',
      }).eq('id', scene.id)
      logger.warn({ sceneId: scene.id, video_id, error }, 'HeyGen scene failed')
    } else {
      logger.info({ event_type, sceneId: scene.id }, 'HeyGen webhook ignored (unknown event)')
    }

    res.status(200).json({ received: true })
  } catch (err) {
    logger.error({ err }, 'HeyGen webhook handler failed')
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { renderQueue } from '../queues/renderQueue'
import { refundCredits } from '../services/credits'

export const videosRouter = Router()

// Statuses from which a generation can still be cancelled. New writes
// only use 'generating' (4-value canonical enum), 'pending'/'processing'
// are legacy values that may still exist on in-flight rows.
const CANCELLABLE_STATUSES = ['pending', 'queued', 'processing', 'generating'] as const

/**
 * GET /api/v1/videos
 * Liste les vidéos de l'utilisateur authentifié
 */
videosRouter.get('/videos', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('videos')
      .select('id, module, style, title, status, output_url, metadata, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      logger.error({ error, userId: req.userId }, 'Failed to fetch videos')
      res.status(500).json({ error: 'Failed to fetch videos', code: 'DB_ERROR' })
      return
    }

    res.json({ data })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'videos.list error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/videos/:id
 * Détail d'une vidéo
 */
videosRouter.get('/videos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params

  try {
    const { data, error } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId) // Garantit que l'utilisateur possède la vidéo
      .single()

    if (error || !data) {
      res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
      return
    }

    res.json({ data })
  } catch (err) {
    logger.error({ err, videoId: id, userId: req.userId }, 'videos.get error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * DELETE /api/v1/videos/:id
 * Soft delete d'une vidéo (met status à 'deleted' — ou vraie suppression selon le besoin)
 */
videosRouter.delete('/videos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params

  try {
    // Vérifier que la vidéo appartient à l'utilisateur
    const { data: existing } = await supabaseAdmin
      .from('videos')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (!existing) {
      res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
      return
    }

    const { error } = await supabaseAdmin.from('videos').delete().eq('id', id)

    if (error) {
      logger.error({ error, videoId: id }, 'Failed to delete video')
      res.status(500).json({ error: 'Failed to delete video', code: 'DB_ERROR' })
      return
    }

    logger.info({ videoId: id, userId: req.userId }, 'Video deleted')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, videoId: id, userId: req.userId }, 'videos.delete error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * PATCH /api/v1/videos/:id
 * Met à jour les métadonnées d'une vidéo (auto-save storyboard, scènes éditées)
 * N'autorise que la mise à jour de `metadata` — pas de status, output_url, etc.
 */
const patchVideoSchema = z.object({
  metadata: z.record(z.unknown()),
})

videosRouter.patch('/videos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params

  const parsed = patchVideoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'metadata object required', code: 'VALIDATION_ERROR' })
    return
  }
  const { metadata } = parsed.data

  try {
    const { data: existing } = await supabaseAdmin
      .from('videos')
      .select('id, metadata')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (!existing) {
      res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
      return
    }

    // Merge incoming metadata with existing metadata (shallow — caller controls keys)
    const merged = { ...(existing.metadata as Record<string, unknown> ?? {}), ...metadata }

    const { error } = await supabaseAdmin
      .from('videos')
      .update({ metadata: merged })
      .eq('id', id)

    if (error) throw new Error(error.message)

    logger.info({ videoId: id, userId: req.userId, keys: Object.keys(metadata) }, 'Video metadata updated')
    res.json({ success: true })
  } catch (err) {
    logger.error({ err, videoId: id, userId: req.userId }, 'videos.patch error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * POST /api/v1/videos/:id/cancel
 * Annule une génération en cours et rembourse la TOTALITÉ des crédits.
 *
 * Déroulé :
 *   (a) retire le job BullMQ de la queue s'il est encore en attente
 *       (jobId === videoId depuis que les routes pipeline passent
 *       { jobId: video.id } à renderQueue.add) ;
 *   (b) passe la row à status='cancelled' avec une garde .in(status)
 *       pour éviter la course avec un job qui se termine ;
 *   (c) refund TOTAL via refundCredits avec la même source `video:<id>`
 *       que la déduction — l'index unique partiel sur credit_ledger
 *       (migration 20260610000000) rend ce refund idempotent : si le
 *       pipeline échoue ensuite et tente AUSSI un refund, c'est un no-op.
 *
 * Si le job est déjà ACTIF dans le worker, le pipeline coopère via
 * assertNotCancelled() (pipelines/cancellation.ts) et s'arrête entre
 * deux étapes majeures sans marquer 'error' ni re-refund.
 */
videosRouter.post('/videos/:id/cancel', authMiddleware, async (req, res) => {
  const { id } = req.params

  try {
    // Ownership + statut courant
    const { data: video } = await supabaseAdmin
      .from('videos')
      .select('id, status, metadata')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single()

    if (!video) {
      res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
      return
    }

    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(video.status)) {
      res.status(409).json({ error: 'Already finished', code: 'ALREADY_FINISHED' })
      return
    }

    // (a) Retirer le job de la queue s'il attend encore. Queue.remove()
    // est un no-op silencieux si le job est déjà actif (lock détenu par
    // le worker) ou inexistant — dans ce cas la coopération du pipeline
    // prend le relais via assertNotCancelled().
    if (renderQueue) {
      await renderQueue.remove(String(id)).then(
        (removed) => {
          if (removed) logger.info({ videoId: id }, 'cancel: waiting job removed from queue')
        },
        (err) => logger.warn({ err, videoId: id }, 'cancel: queue remove failed (job likely active) — pipeline will cooperate'),
      )
    }

    // (b) Marquer cancelled — la garde .in() évite d'écraser un 'done'
    // posé par un job qui vient de finir entre le SELECT et l'UPDATE.
    const existingMeta = (video.metadata ?? {}) as Record<string, unknown>
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('videos')
      .update({
        status: 'cancelled',
        metadata: { ...existingMeta, cancelled_at: new Date().toISOString() },
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .in('status', [...CANCELLABLE_STATUSES])
      .select('id')

    if (updErr) {
      logger.error({ err: updErr, videoId: id }, 'cancel: status update failed')
      res.status(500).json({ error: 'Failed to cancel video', code: 'DB_ERROR' })
      return
    }

    if (!updated || updated.length === 0) {
      // Course perdue : le job a fini (done/error) entre-temps.
      res.status(409).json({ error: 'Already finished', code: 'ALREADY_FINISHED' })
      return
    }

    // (c) Refund TOTAL. Le montant déduit vit dans le ledger (type
    // 'consume', amount négatif, source `video:<id>`). Les plans
    // unlimited n'écrivent pas de ligne 'consume' → rien à rembourser.
    let refunded = 0
    const { data: ledgerRows } = await supabaseAdmin
      .from('credit_ledger')
      .select('amount')
      .eq('user_id', req.userId)
      .eq('source', `video:${id}`)
      .eq('type', 'consume')

    const deducted = (ledgerRows ?? []).reduce((sum, row) => sum + Math.abs(row.amount as number), 0)
    if (deducted > 0) {
      // Idempotent : l'index unique credit_ledger(source) WHERE type='refund'
      // absorbe un éventuel double refund (route + pipeline) en no-op.
      await refundCredits(req.userId!, deducted, `video:${id}`, { reason: 'user_cancelled' })
        .then(() => { refunded = deducted })
        .catch((err) => logger.error({ err, videoId: id, deducted }, 'cancel: refund failed (non-blocking)'))
    }

    logger.info({ videoId: id, userId: req.userId, refunded }, 'Video generation cancelled by user')
    res.json({ cancelled: true, credits_refunded: refunded })
  } catch (err) {
    logger.error({ err, videoId: id, userId: req.userId }, 'videos.cancel error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

/**
 * GET /api/v1/videos/:id/status — SSE stream
 * Suivi temps réel du statut de génération
 */
videosRouter.get('/videos/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params

  // Vérifier que la vidéo appartient à l'utilisateur
  const { data: video } = await supabaseAdmin
    .from('videos')
    .select('id, status, output_url, metadata')
    .eq('id', id)
    .eq('user_id', req.userId)
    .single()

  if (!video) {
    res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' })
    return
  }

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Nécessaire sur Nginx/Render

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Envoyer le statut initial
  const initialMeta = video.metadata as { progress?: number; error_message?: string } | null
  sendEvent({
    status: video.status,
    progress: initialMeta?.progress ?? 0,
    output_url: (video as { output_url?: string }).output_url ?? null,
    error_message: initialMeta?.error_message ?? null,
  })

  // Si déjà terminé (cancelled est terminal au même titre que done/error),
  // fermer immédiatement
  if (video.status === 'done' || video.status === 'error' || video.status === 'cancelled') {
    res.end()
    return
  }

  // Heartbeat — SSE comments every 25s so proxies (Render/Nginx) don't
  // kill the idle connection during long renders. Must be cleared both
  // on client disconnect and before any res.end().
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
  }, 25_000)

  // Supabase Realtime — postgres_changes sur la row vidéo
  // Zéro requête DB supplémentaire pendant le rendu (vs 30+ avec le polling 2s)
  const channel = supabaseAdmin
    .channel(`video-status-${id}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'videos', filter: `id=eq.${id}` },
      (payload) => {
        const updated = payload.new as { status: string; output_url?: string; metadata?: Record<string, unknown> }
        const meta = updated.metadata as { progress?: number; error_message?: string } | null
        sendEvent({
          status: updated.status,
          progress: meta?.progress ?? 0,
          output_url: updated.output_url ?? null,
          error_message: meta?.error_message ?? null,
        })
        if (updated.status === 'done' || updated.status === 'error' || updated.status === 'cancelled') {
          clearInterval(heartbeat)
          channel.unsubscribe().catch(() => null)
          res.end()
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        logger.error({ videoId: id }, 'Supabase Realtime channel error — closing SSE')
        sendEvent({ status: 'error', progress: 0, output_url: null, error_message: 'Realtime channel disconnected — refresh the page' })
        clearInterval(heartbeat)
        res.end()
      }
    })

  // Cleanup si le client se déconnecte
  req.on('close', () => {
    clearInterval(heartbeat)
    channel.unsubscribe().catch(() => null)
  })
})

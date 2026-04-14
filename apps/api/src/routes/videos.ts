import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export const videosRouter = Router()

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
videosRouter.patch('/videos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params
  const { metadata } = req.body as { metadata?: Record<string, unknown> }

  if (!metadata || typeof metadata !== 'object') {
    res.status(400).json({ error: 'metadata object required', code: 'VALIDATION_ERROR' })
    return
  }

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

  // Si déjà terminé, fermer immédiatement
  if (video.status === 'done' || video.status === 'error') {
    res.end()
    return
  }

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
        if (updated.status === 'done' || updated.status === 'error') {
          channel.unsubscribe().catch(() => null)
          res.end()
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        logger.error({ videoId: id }, 'Supabase Realtime channel error — closing SSE')
        sendEvent({ status: 'error', progress: 0, output_url: null, error_message: 'Realtime channel disconnected — refresh the page' })
        res.end()
      }
    })

  // Cleanup si le client se déconnecte
  req.on('close', () => {
    channel.unsubscribe().catch(() => null)
  })
})

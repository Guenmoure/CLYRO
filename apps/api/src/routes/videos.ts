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
 * GET /api/v1/videos/:id/status — SSE stream
 * Suivi temps réel du statut de génération
 */
videosRouter.get('/videos/:id/status', authMiddleware, async (req, res) => {
  const { id } = req.params

  // Vérifier que la vidéo appartient à l'utilisateur
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

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Nécessaire sur Nginx/Render

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Envoyer le statut initial
  sendEvent({
    status: video.status,
    progress: (video.metadata as { progress?: number })?.progress ?? 0,
  })

  // Si déjà terminé, fermer immédiatement
  if (video.status === 'done' || video.status === 'error') {
    res.end()
    return
  }

  // Polling Supabase toutes les 2s (SSE via polling simple)
  const interval = setInterval(async () => {
    try {
      const { data: updated } = await supabaseAdmin
        .from('videos')
        .select('status, metadata')
        .eq('id', id)
        .single()

      if (updated) {
        sendEvent({
          status: updated.status,
          progress: (updated.metadata as { progress?: number })?.progress ?? 0,
        })

        if (updated.status === 'done' || updated.status === 'error') {
          clearInterval(interval)
          res.end()
        }
      }
    } catch (err) {
      logger.error({ err, videoId: id }, 'SSE polling error')
      clearInterval(interval)
      res.end()
    }
  }, 2000)

  // Cleanup si le client se déconnecte
  req.on('close', () => {
    clearInterval(interval)
  })
})

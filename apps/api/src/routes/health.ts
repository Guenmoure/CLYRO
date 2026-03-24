import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export const healthRouter = Router()

/**
 * GET /api/v1/health
 * Health check — vérifie la connectivité DB
 * Utilisé par Render pour les checks de disponibilité
 */
healthRouter.get('/health', async (_req, res) => {
  try {
    // Vérifier la connectivité Supabase
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1)

    if (error) {
      logger.error({ error }, 'Health check: Supabase connection failed')
      res.status(503).json({
        status: 'unhealthy',
        service: 'clyro-api',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      })
      return
    }

    res.json({
      status: 'healthy',
      service: 'clyro-api',
      version: process.env.npm_package_version ?? '1.0.0',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error({ err }, 'Health check error')
    res.status(503).json({
      status: 'unhealthy',
      service: 'clyro-api',
      timestamp: new Date().toISOString(),
    })
  }
})

import type { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { logger } from '../lib/logger'

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      userId: string
      userEmail: string
    }
  }
}

/**
 * Middleware d'authentification JWT Supabase
 *
 * - Vérifie le Bearer token dans l'header Authorization
 * - Valide le JWT auprès de Supabase
 * - Injecte userId et userEmail dans req
 * - Retourne 401 si non authentifié
 *
 * RÈGLE R3 : toutes les routes protégées DOIVENT passer par ce middleware
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No authentication token provided', code: 'UNAUTHORIZED' })
    return
  }

  const token = authHeader.slice(7) // Remove 'Bearer '

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('Missing Supabase environment variables in auth middleware')
    res.status(500).json({ error: 'Server configuration error', code: 'CONFIG_ERROR' })
    return
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      logger.warn({ path: req.path }, 'Invalid or expired JWT token')
      res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' })
      return
    }

    req.userId = user.id
    req.userEmail = user.email ?? ''

    next()
  } catch (err) {
    logger.error({ err, path: req.path }, 'Auth middleware error')
    res.status(500).json({ error: 'Authentication error', code: 'AUTH_ERROR' })
  }
}

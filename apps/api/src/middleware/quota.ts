import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export interface UserProfile {
  credits: number
  plan: string
}

// Extend Express Request to carry the authenticated user's profile
declare global {
  namespace Express {
    interface Request {
      userProfile?: UserProfile
    }
  }
}

/**
 * Middleware de vérification des crédits (quota).
 *
 * - Récupère le profil de l'utilisateur (credits + plan)
 * - Retourne 403 si crédits insuffisants (sauf plan studio — illimité)
 * - Injecte req.userProfile pour éviter un deuxième appel DB dans la route
 *
 * RÈGLE : toujours placer APRÈS authMiddleware (req.userId doit être défini).
 */
export async function quotaMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('credits, plan')
      .eq('id', req.userId)
      .single()

    if (error || !profile) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' })
      return
    }

    if (profile.plan !== 'studio' && profile.credits <= 0) {
      logger.warn({ userId: req.userId, credits: profile.credits }, 'Quota exceeded')
      res.status(403).json({ error: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' })
      return
    }

    req.userProfile = { credits: profile.credits, plan: profile.plan }
    next()
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'quotaMiddleware error')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
}

/**
 * Décrémente les crédits de l'utilisateur d'1 unité.
 * No-op si plan studio.
 * Non-bloquant — les erreurs sont loggées mais n'échouent pas la requête.
 */
export async function deductCredit(userId: string, profile: UserProfile): Promise<void> {
  if (profile.plan === 'studio') return
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ credits: profile.credits - 1 })
    .eq('id', userId)
  if (error) {
    logger.error({ error, userId }, 'Failed to deduct credit')
  }
}

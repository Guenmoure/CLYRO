import { Router } from 'express'

/**
 * Router pour les routes internes inter-services.
 * Toutes les routes ici sont protégées par hmacMiddleware (index.ts).
 *
 * Usage typique : callbacks de workers BullMQ, crons internes, Remotion Lambda callbacks.
 *
 * Exemple d'ajout de route :
 *   internalRouter.post('/ping', (req, res) => res.json({ ok: true }))
 */
export const internalRouter = Router()

// Health check interne (utile pour vérifier que le secret HMAC est bien configuré)
internalRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, service: 'clyro-api-internal' })
})

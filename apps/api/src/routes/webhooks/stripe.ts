import { Router } from 'express'
import { handleStripeWebhook } from '../../services/stripe'
import { logger } from '../../lib/logger'

export const stripeWebhookRouter = Router()

/**
 * POST /webhook/stripe
 * Webhook Stripe — PAS d'authMiddleware (vérification signature)
 *
 * RÈGLE R4 : vérification de signature obligatoire
 * IMPORTANT : ce handler reçoit le raw body (monté AVANT express.json() dans index.ts)
 */
stripeWebhookRouter.post('/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature']

  if (!signature || typeof signature !== 'string') {
    logger.warn('Stripe webhook: missing stripe-signature header')
    res.status(400).json({ error: 'Missing stripe-signature header', code: 'INVALID_REQUEST' })
    return
  }

  // req.body est un Buffer (raw body) car monté avec express.raw()
  if (!Buffer.isBuffer(req.body)) {
    logger.error('Stripe webhook: body is not a raw buffer — check middleware order')
    res.status(400).json({ error: 'Invalid request body', code: 'INVALID_BODY' })
    return
  }

  try {
    await handleStripeWebhook(req.body, signature)
    res.json({ received: true })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    // Signature invalide → 400 (Stripe ne retentera pas)
    if (errorMessage.includes('signature')) {
      logger.error({ err }, 'Stripe webhook: invalid signature')
      res.status(400).json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' })
      return
    }

    // TODO Phase 3 : retourner 200 pour éviter les retentatives Stripe sur erreurs métier
    logger.error({ err }, 'Stripe webhook: processing error')
    res.status(500).json({ error: 'Webhook processing error', code: 'WEBHOOK_ERROR' })
  }
})

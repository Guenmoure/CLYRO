import { Router } from 'express'
import { handleMonerooWebhook } from '../../services/moneroo'
import { logger } from '../../lib/logger'

export const monerooWebhookRouter = Router()

/**
 * POST /webhook/moneroo
 * Webhook Moneroo Mobile Money — PAS d'authMiddleware (vérification signature)
 *
 * RÈGLE R4 : signature vérifiée DANS handleMonerooWebhook avant tout traitement
 */
monerooWebhookRouter.post('/moneroo', async (req, res) => {
  // Extraire la signature depuis les headers Moneroo
  // TODO Phase 3 : vérifier le nom exact du header de signature Moneroo
  const signature =
    (req.headers['x-moneroo-signature'] as string) ??
    (req.headers['moneroo-signature'] as string) ??
    ''

  if (!signature) {
    logger.warn('Moneroo webhook: missing signature header')
    res.status(400).json({ error: 'Missing signature header', code: 'INVALID_REQUEST' })
    return
  }

  if (!Buffer.isBuffer(req.body)) {
    logger.error('Moneroo webhook: body is not a raw buffer — check middleware order')
    res.status(400).json({ error: 'Invalid request body', code: 'INVALID_BODY' })
    return
  }

  const rawBody = req.body.toString('utf-8')

  try {
    await handleMonerooWebhook(rawBody, signature)
    res.json({ received: true })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'

    if (errorMessage.includes('signature')) {
      logger.error({ err }, 'Moneroo webhook: invalid signature — ignoring')
      // Retourner 400 pour indiquer requête invalide
      res.status(400).json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' })
      return
    }

    logger.error({ err }, 'Moneroo webhook: processing error')
    res.status(200).json({ received: true, warning: 'Processing error logged' })
  }
})

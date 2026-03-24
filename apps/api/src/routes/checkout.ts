import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { createCheckoutSession } from '../services/stripe'
import { createMonerooPayment } from '../services/moneroo'
import { logger } from '../lib/logger'

export const checkoutRouter = Router()

const stripeCheckoutSchema = z.object({
  plan: z.enum(['starter', 'studio']),
})

const monerooCheckoutSchema = z.object({
  plan: z.enum(['starter', 'studio']),
  phone: z.string().min(8).max(20),
  currency: z.enum(['XOF', 'EUR', 'USD']).optional().default('XOF'),
})

/**
 * POST /api/v1/checkout/stripe
 * Crée une session de checkout Stripe
 */
checkoutRouter.post('/checkout/stripe', authMiddleware, async (req, res) => {
  const parsed = stripeCheckoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    const session = await createCheckoutSession({
      userId: req.userId,
      email: req.userEmail,
      plan: parsed.data.plan,
    })
    res.json({ checkout_url: session.url })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'checkout.stripe error')
    res.status(500).json({ error: 'Failed to create checkout session', code: 'STRIPE_ERROR' })
  }
})

/**
 * POST /api/v1/checkout/moneroo
 * Crée un paiement Moneroo (Mobile Money)
 */
checkoutRouter.post('/checkout/moneroo', authMiddleware, async (req, res) => {
  const parsed = monerooCheckoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    const payment = await createMonerooPayment({
      userId: req.userId,
      email: req.userEmail,
      plan: parsed.data.plan,
      phone: parsed.data.phone,
      currency: parsed.data.currency,
    })
    res.json({ payment_url: payment.paymentUrl })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'checkout.moneroo error')
    res.status(500).json({ error: 'Failed to create payment', code: 'MONEROO_ERROR' })
  }
})

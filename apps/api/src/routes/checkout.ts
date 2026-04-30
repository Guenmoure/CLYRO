import { Router } from 'express'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { createCheckoutSession, createTopupCheckoutSession } from '../services/stripe'
import { createMonerooPayment } from '../services/moneroo'
import { logger } from '../lib/logger'

export const checkoutRouter = Router()

// All paid plans (Free has no Stripe product). Aligned with the 5 plans
// declared in @clyro/shared/credits.
const PAID_PLAN = z.enum(['starter', 'pro', 'creator', 'studio'])

const stripeCheckoutSchema = z.object({
  plan: PAID_PLAN,
})

const monerooCheckoutSchema = z.object({
  // Moneroo currently supports starter/studio only — kept narrow on purpose
  // to avoid surprising the user with a price they can't pay locally.
  plan: z.enum(['starter', 'studio']),
  phone: z.string().min(8).max(20),
  currency: z.enum(['XOF', 'EUR', 'USD']).optional().default('XOF'),
})

const topupCheckoutSchema = z.object({
  pack: z.enum(['boost', 'pro_boost', 'power', 'studio']),
})

/**
 * POST /api/v1/checkout/stripe
 * Crée une session Stripe Checkout pour un abonnement mensuel
 * (starter / pro / creator / studio).
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
      email:  req.userEmail,
      plan:   parsed.data.plan,
    })
    res.json({ checkout_url: session.url })
  } catch (err) {
    logger.error({ err, userId: req.userId, plan: parsed.data.plan }, 'checkout.stripe error')
    res.status(500).json({ error: 'Failed to create checkout session', code: 'STRIPE_ERROR' })
  }
})

/**
 * POST /api/v1/checkout/topup
 * Crée une session Stripe Checkout en mode "payment" (one-shot) pour
 * acheter un pack de crédits (Boost / Pro Boost / Power / Studio).
 *
 * Le webhook Stripe (checkout.session.completed avec metadata.kind='topup')
 * crédite le solde via grantCredits(...,'topup',...) — voir services/stripe.ts.
 */
checkoutRouter.post('/checkout/topup', authMiddleware, async (req, res) => {
  const parsed = topupCheckoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    const session = await createTopupCheckoutSession({
      userId: req.userId,
      email:  req.userEmail,
      packId: parsed.data.pack,
    })
    res.json({ checkout_url: session.url })
  } catch (err) {
    logger.error({ err, userId: req.userId, pack: parsed.data.pack }, 'checkout.topup error')
    res.status(500).json({ error: 'Failed to create topup session', code: 'STRIPE_ERROR' })
  }
})

/**
 * POST /api/v1/checkout/moneroo
 * Crée un paiement Moneroo (Mobile Money).
 */
checkoutRouter.post('/checkout/moneroo', authMiddleware, async (req, res) => {
  const parsed = monerooCheckoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  try {
    const payment = await createMonerooPayment({
      userId:   req.userId,
      email:    req.userEmail,
      plan:     parsed.data.plan,
      phone:    parsed.data.phone,
      currency: parsed.data.currency,
    })
    res.json({ payment_url: payment.paymentUrl })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'checkout.moneroo error')
    res.status(500).json({ error: 'Failed to create payment', code: 'MONEROO_ERROR' })
  }
})

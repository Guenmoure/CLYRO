import Stripe from 'stripe'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-02-24.acacia',
})

// Configure these in your Stripe dashboard and update here
const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? 'price_TODO_starter',
  studio:  process.env.STRIPE_PRICE_STUDIO  ?? 'price_TODO_studio',
}

const PLAN_CREDITS: Record<string, number> = {
  starter: 30,
  studio:  -1, // -1 = illimité (studio plan)
}

interface CreateCheckoutParams {
  userId: string
  email: string
  plan: 'starter' | 'studio'
}

interface CheckoutSession {
  id: string
  url: string | null
}

/**
 * Crée une session de checkout Stripe (abonnement mensuel)
 * RÈGLE R1 : STRIPE_SECRET_KEY chargée depuis process.env uniquement
 */
export async function createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
  const { userId, email, plan } = params

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  const session = await stripe.checkout.sessions.create({
    customer_email: email,
    mode: 'subscription',
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
    cancel_url:  `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  })

  logger.info({ userId, plan, sessionId: session.id }, 'Stripe checkout session created')
  return { id: session.id, url: session.url }
}

/**
 * Gère les événements webhook Stripe
 * RÈGLE R4 : signature vérifiée AVANT tout traitement
 */
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET')

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    logger.error({ err }, 'Stripe: invalid webhook signature')
    throw new Error('Invalid Stripe webhook signature')
  }

  logger.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received')

  switch (event.type) {
    case 'checkout.session.completed':
      await activateSubscription(event.data.object as Stripe.Checkout.Session)
      break
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
      await cancelSubscription(event.data.object as Stripe.Subscription)
      break
    default:
      logger.info({ eventType: event.type }, 'Stripe webhook: unhandled event type')
  }
}

async function activateSubscription(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId
  const plan   = session.metadata?.plan as 'starter' | 'studio' | undefined

  if (!userId || !plan) {
    logger.error({ sessionId: session.id }, 'Stripe: missing userId or plan in session metadata')
    return
  }

  // Idempotency: skip if already processed
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('provider', 'stripe')
    .eq('status', 'success')
    .filter('metadata->>session_id', 'eq', session.id)
    .maybeSingle()

  if (existing) {
    logger.info({ sessionId: session.id }, 'Stripe: webhook already processed — skipping')
    return
  }

  const credits = PLAN_CREDITS[plan] === -1 ? 999999 : PLAN_CREDITS[plan]

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ plan, credits })
    .eq('id', userId)

  if (error) {
    logger.error({ error, userId, plan }, 'Stripe: failed to update profile after checkout')
    throw new Error('Failed to activate subscription in database')
  }

  await supabaseAdmin.from('payments').insert({
    user_id:  userId,
    provider: 'stripe',
    amount:   session.amount_total ? session.amount_total / 100 : 0,
    currency: (session.currency ?? 'eur').toUpperCase(),
    status:   'success',
    metadata: { session_id: session.id, plan, subscription_id: session.subscription },
  })

  logger.info({ userId, plan }, 'Stripe: subscription activated')
}

async function cancelSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId

  if (!userId) {
    logger.warn({ subscriptionId: subscription.id }, 'Stripe: missing userId in subscription metadata')
    return
  }

  await supabaseAdmin
    .from('profiles')
    .update({ plan: 'free', credits: 3 })
    .eq('id', userId)

  logger.info({ userId, subscriptionId: subscription.id }, 'Stripe: subscription cancelled — reverted to free')
}

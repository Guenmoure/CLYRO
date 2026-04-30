import Stripe from 'stripe'
import {
  type PlanId,
  PLAN_MONTHLY_CREDITS,
  getStripePriceMap,
  planFromStripePriceId,
} from '@clyro/shared'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { setPlan, grantCredits } from './credits'

// ── Lazy Stripe client ──────────────────────────────────────────────────
// Avoid crashing at module-load when STRIPE_SECRET_KEY isn't set
// (e.g. local dev without billing).

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' })
  }
  return _stripe
}

// Plans we can checkout into (Free has no Stripe product).
type PaidPlan = Exclude<PlanId, 'free'>

interface CreateCheckoutParams {
  userId: string
  email:  string
  plan:   PaidPlan
}

interface CheckoutSession {
  id:  string
  url: string | null
}

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSession> {
  const { userId, email, plan } = params
  const priceId = getStripePriceMap()[plan]
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan "${plan}". Set STRIPE_PRICE_${plan.toUpperCase()}.`)
  }

  const session = await getStripe().checkout.sessions.create({
    customer_email: email,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
    cancel_url:  `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  })

  logger.info({ userId, plan, sessionId: session.id }, 'Stripe checkout session created')
  return { id: session.id, url: session.url }
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET')

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    logger.error({ err }, 'Stripe: invalid webhook signature')
    throw new Error('Invalid Stripe webhook signature')
  }

  logger.info({ eventType: event.type, eventId: event.id }, 'Stripe webhook received')

  switch (event.type) {
    case 'checkout.session.completed':
      await activateSubscription(event.data.object as Stripe.Checkout.Session)
      break
    case 'invoice.paid':
      // Recurring monthly invoice = grant the next month's credits.
      // Note: the renewal cron is the primary mechanism; this branch
      // is a defensive backup in case the cron is down.
      await handleInvoicePaid(event.data.object as Stripe.Invoice)
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
  const planFromMetadata = session.metadata?.plan as PlanId | undefined

  if (!userId) {
    logger.error({ sessionId: session.id }, 'Stripe: missing userId in session metadata')
    return
  }

  // Resolve plan: trust metadata first, fall back to looking up the price.
  let plan: PaidPlan | null = null
  if (planFromMetadata && planFromMetadata !== 'free') {
    plan = planFromMetadata as PaidPlan
  } else {
    // Fallback for sessions created outside our codepath (e.g. direct
    // payment links) — read the line item to find the price.
    try {
      const items = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 })
      const priceId = items.data[0]?.price?.id
      const resolved = priceId ? planFromStripePriceId(priceId) : null
      if (resolved && resolved !== 'free') plan = resolved
    } catch (err) {
      logger.warn({ err, sessionId: session.id }, 'Stripe: line items lookup failed')
    }
  }

  if (!plan) {
    logger.error({ sessionId: session.id }, 'Stripe: could not resolve plan from session')
    return
  }

  // Idempotency: skip if we've already processed this session.
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

  // 1. Set the plan + monthly_credits on the profile.
  await setPlan(userId, plan)

  // 2. Grant the first month's credits via the ledger so it's audited.
  const firstMonth = PLAN_MONTHLY_CREDITS[plan]
  await grantCredits(userId, firstMonth, 'subscription', `stripe:${session.id}`, {
    plan,
    stripe_session_id: session.id,
    stripe_subscription_id: session.subscription,
    reason: 'checkout_completed',
  })

  // 3. Record the payment for accounting.
  await supabaseAdmin.from('payments').insert({
    user_id:  userId,
    provider: 'stripe',
    amount:   session.amount_total ? session.amount_total / 100 : 0,
    currency: (session.currency ?? 'eur').toUpperCase(),
    status:   'success',
    metadata: { session_id: session.id, plan, subscription_id: session.subscription },
  })

  logger.info({ userId, plan, credits: firstMonth }, 'Stripe: subscription activated')
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Only act on subscription renewals — not the first invoice
  // (which is already covered by checkout.session.completed).
  if (invoice.billing_reason !== 'subscription_cycle') return

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null
  if (!subscriptionId) return

  // Fetch the subscription to get our metadata.
  const sub = await getStripe().subscriptions.retrieve(subscriptionId)
  const userId = sub.metadata?.userId
  const plan   = sub.metadata?.plan as PlanId | undefined
  if (!userId || !plan || plan === 'free') return

  // Idempotency on the invoice id.
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('provider', 'stripe')
    .eq('status', 'success')
    .filter('metadata->>invoice_id', 'eq', invoice.id)
    .maybeSingle()
  if (existing) return

  await grantCredits(userId, PLAN_MONTHLY_CREDITS[plan], 'subscription', `stripe:${invoice.id}`, {
    plan,
    stripe_invoice_id: invoice.id,
    stripe_subscription_id: subscriptionId,
    reason: 'recurring_invoice',
  })

  await supabaseAdmin
    .from('profiles')
    .update({ subscription_renewed_at: new Date().toISOString() })
    .eq('id', userId)

  await supabaseAdmin.from('payments').insert({
    user_id:  userId,
    provider: 'stripe',
    amount:   invoice.amount_paid / 100,
    currency: (invoice.currency ?? 'eur').toUpperCase(),
    status:   'success',
    metadata: { invoice_id: invoice.id, plan, subscription_id: subscriptionId },
  })

  logger.info({ userId, plan, invoiceId: invoice.id }, 'Stripe: recurring invoice processed')
}

async function cancelSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.userId
  if (!userId) {
    logger.warn({ subscriptionId: subscription.id }, 'Stripe: missing userId in subscription metadata')
    return
  }

  // Revert to Free. Existing balance is preserved (roll-over rule).
  await setPlan(userId, 'free')

  logger.info({ userId, subscriptionId: subscription.id }, 'Stripe: subscription cancelled — reverted to free (balance kept)')
}

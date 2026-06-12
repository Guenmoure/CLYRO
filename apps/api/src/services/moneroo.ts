import { createHmac, timingSafeEqual } from 'crypto'
import { type PlanId, PLAN_MONTHLY_CREDITS } from '@clyro/shared'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'
import { setPlan, grantCredits } from './credits'

const MONEROO_API_URL = 'https://api.moneroo.io/v1'

// Prices in XOF (West African CFA franc)
// Update with validated rates from your Moneroo dashboard
const PLAN_PRICES: Record<string, number> = {
  starter: 12500, // ~19 EUR
  studio:  32000, // ~49 EUR
}

// Plans purchasable via Moneroo Mobile Money.
const MONEROO_PLANS = new Set<PlanId>(['starter', 'studio'])

interface CreateMonerooPaymentParams {
  userId: string
  email: string
  plan: 'starter' | 'studio'
  phone: string
  currency?: string
}

interface MonerooPaymentResponse {
  paymentUrl: string
  paymentId: string
}

/**
 * Crée un paiement Mobile Money via Moneroo
 * Supporte : Orange Money, Wave, MTN Mobile Money, Moov Money
 * RÈGLE R1 : MONEROO_API_KEY chargée depuis process.env uniquement
 */
export async function createMonerooPayment(
  params: CreateMonerooPaymentParams
): Promise<MonerooPaymentResponse> {
  const apiKey = process.env.MONEROO_API_KEY
  if (!apiKey) throw new Error('MONEROO_API_KEY is not configured')

  const { userId, email, plan, phone, currency = 'XOF' } = params

  const response = await fetch(`${MONEROO_API_URL}/payments/initialize`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount:      PLAN_PRICES[plan],
      currency,
      description: `CLYRO — Plan ${plan}`,
      customer:    { email, phone, first_name: '', last_name: '' },
      metadata:    { userId, plan },
      return_url:  `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      notify_url:  `${process.env.BACKEND_URL}/webhook/moneroo`,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error({ status: response.status, error: errorText }, 'Moneroo API error')
    throw new Error(`Moneroo API error: ${response.status}`)
  }

  const data = await response.json() as { payment_url: string; id: string }

  // Pré-enregistrer le paiement en "pending"
  const { error: insertError } = await supabaseAdmin.from('payments').insert({
    user_id:  userId,
    provider: 'moneroo',
    amount:   PLAN_PRICES[plan],
    currency: 'XOF',
    status:   'pending',
    metadata: { payment_id: data.id, plan, phone },
  })
  if (insertError) logger.warn({ err: insertError }, 'Moneroo: failed to pre-record payment')

  logger.info({ userId, plan, paymentId: data.id }, 'Moneroo payment initialized')
  return { paymentUrl: data.payment_url, paymentId: data.id }
}

/**
 * Vérifie la signature HMAC-SHA256 d'un webhook Moneroo
 * RÈGLE R4 : toujours vérifier AVANT tout traitement
 */
export function verifyMonerooSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.MONEROO_WEBHOOK_SECRET
  if (!secret) {
    logger.error('Missing MONEROO_WEBHOOK_SECRET')
    return false
  }

  const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex')

  // Constant-time comparison — a plain === leaks timing information that
  // lets an attacker brute-force the signature byte by byte.
  const provided = Buffer.from(signature, 'utf8')
  const expected = Buffer.from(expectedSignature, 'utf8')
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

/**
 * Gère les événements webhook Moneroo
 * RÈGLE R4 : signature vérifiée AVANT traitement
 */
export async function handleMonerooWebhook(rawBody: string, signature: string): Promise<void> {
  if (!verifyMonerooSignature(rawBody, signature)) {
    logger.error('Moneroo: invalid webhook signature')
    throw new Error('Invalid Moneroo webhook signature')
  }

  const event = JSON.parse(rawBody) as {
    id: string
    status: 'success' | 'failed' | 'cancelled'
    metadata?: { userId?: string; plan?: string }
    amount?: number
    currency?: string
  }

  logger.info({ eventId: event.id, status: event.status }, 'Moneroo webhook received')

  switch (event.status) {
    case 'success':
      if (event.metadata?.userId && event.metadata?.plan) {
        await activateSubscription(event.metadata.userId, event.metadata.plan, event.id)
      }
      break
    case 'failed':
    case 'cancelled':
      // Mettre à jour le statut du paiement
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('metadata->>payment_id', event.id)
        .then(() => null, (err) => logger.warn({ err }, 'Moneroo: failed to update payment status'))
      logger.info({ paymentId: event.id, status: event.status }, 'Moneroo: payment not completed')
      break
  }
}

async function activateSubscription(userId: string, plan: string, paymentId: string): Promise<void> {
  if (!MONEROO_PLANS.has(plan as PlanId)) {
    logger.error({ userId, plan, paymentId }, 'Moneroo: unknown plan in webhook metadata — ignoring')
    return
  }
  const planId = plan as PlanId

  // Idempotency: Moneroo can retry webhooks — skip if this payment id was
  // already processed (same pattern as Stripe's session_id dedup).
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('provider', 'moneroo')
    .eq('status', 'success')
    .filter('metadata->>payment_id', 'eq', paymentId)
    .maybeSingle()

  if (existing) {
    logger.info({ paymentId }, 'Moneroo: webhook already processed — skipping')
    return
  }

  // 1. Set the plan + monthly_credits + renewal clock on the profile.
  //    Never overwrite the credits balance directly — the ledger is the
  //    source of truth and balances roll over by design.
  await setPlan(userId, planId)

  // 2. Grant the first month's credits via the ledger so it's audited.
  const firstMonth = PLAN_MONTHLY_CREDITS[planId]
  await grantCredits(userId, firstMonth, 'subscription', `moneroo:${paymentId}`, {
    plan: planId,
    moneroo_payment_id: paymentId,
    reason: 'mobile_money_payment',
  })

  // 3. Mark the pre-recorded payment as success (insert one if the
  //    pre-record was lost so the dedup above still works on retry).
  const { data: updated } = await supabaseAdmin
    .from('payments')
    .update({ status: 'success' })
    .eq('provider', 'moneroo')
    .filter('metadata->>payment_id', 'eq', paymentId)
    .select('id')

  if (!updated || updated.length === 0) {
    const { error: insertError } = await supabaseAdmin.from('payments').insert({
      user_id:  userId,
      provider: 'moneroo',
      amount:   PLAN_PRICES[planId] ?? 0,
      currency: 'XOF',
      status:   'success',
      metadata: { payment_id: paymentId, plan: planId },
    })
    if (insertError) {
      logger.warn({ err: insertError, paymentId }, 'Moneroo: failed to record success payment')
    }
  }

  logger.info({ userId, plan: planId, paymentId, credits: firstMonth }, 'Moneroo: subscription activated')
}

import { createHmac } from 'crypto'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

const MONEROO_API_URL = 'https://api.moneroo.io/v1'

// Prices in XOF (West African CFA franc)
// Update with validated rates from your Moneroo dashboard
const PLAN_PRICES: Record<string, number> = {
  starter: 12500, // ~19 EUR
  studio:  32000, // ~49 EUR
}

const PLAN_CREDITS: Record<string, number> = {
  starter: 30,
  studio:  999999, // illimité
}

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
  return signature === expectedSignature
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
  const credits = PLAN_CREDITS[plan] ?? 0

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ plan, credits })
    .eq('id', userId)

  if (error) {
    logger.error({ error, userId, plan }, 'Moneroo: failed to update profile after payment')
    throw new Error('Failed to activate subscription in database')
  }

  await supabaseAdmin
    .from('payments')
    .update({ status: 'success' })
    .eq('metadata->>payment_id', paymentId)
    .then(() => null, (err) => logger.warn({ err }, 'Moneroo: failed to update payment record'))

  logger.info({ userId, plan, paymentId }, 'Moneroo: subscription activated')
}

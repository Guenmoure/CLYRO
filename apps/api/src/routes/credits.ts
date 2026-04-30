import { Router } from 'express'
import { z } from 'zod'
import {
  PLAN_LABELS,
  PLAN_MONTHLY_CREDITS,
  TOPUP_PACKS,
  getTopupPack,
} from '@clyro/shared'
import { authMiddleware } from '../middleware/auth'
import { hmacMiddleware } from '../middleware/hmac'
import { logger } from '../lib/logger'
import { supabaseAdmin } from '../lib/supabase'
import {
  getBalance,
  grantCredits,
  renewDueSubscriptions,
} from '../services/credits'

export const creditsRouter = Router()

// ── GET /api/v1/credits/balance ───────────────────────────────────────────
// Returns the authenticated user's current balance + plan + last 20
// ledger entries. Powers the CreditsBanner and the billing settings page.

creditsRouter.get('/credits/balance', authMiddleware, async (req, res) => {
  try {
    const balance = await getBalance(req.userId!)
    if (!balance) {
      res.status(404).json({ error: 'Profile not found', code: 'NOT_FOUND' })
      return
    }

    const { data: ledger } = await supabaseAdmin
      .from('credit_ledger')
      .select('id, type, amount, balance_after, source, metadata, created_at')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .limit(20)

    res.json({
      balance:                 balance.credits,
      monthly_credits:         balance.monthly_credits,
      plan:                    balance.plan,
      plan_label:              PLAN_LABELS[balance.plan],
      subscription_renewed_at: balance.subscription_renewed_at,
      next_renewal_at:         balance.subscription_renewed_at
        ? new Date(new Date(balance.subscription_renewed_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      ledger: ledger ?? [],
    })
  } catch (err) {
    logger.error({ err, userId: req.userId }, 'GET /credits/balance failed')
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL_ERROR' })
  }
})

// ── POST /api/v1/credits/topup ────────────────────────────────────────────
// Granting endpoint for credit packs. Stripe integration is OUT OF SCOPE
// for this commit — for now this endpoint requires HMAC signing (i.e.
// only callable server-to-server, e.g. by an admin tool, or by a future
// Stripe checkout webhook). Authenticated end-users CANNOT self-grant.

const topupSchema = z.object({
  user_id: z.string().uuid(),
  pack_id: z.enum(['boost', 'pro_boost', 'power', 'studio']),
  source:  z.string().optional(),
})

creditsRouter.post('/credits/topup', hmacMiddleware, async (req, res) => {
  const parsed = topupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' })
    return
  }

  const pack = getTopupPack(parsed.data.pack_id)
  if (!pack) {
    res.status(400).json({ error: 'Unknown topup pack', code: 'INVALID_PACK' })
    return
  }

  try {
    const newBalance = await grantCredits(
      parsed.data.user_id,
      pack.credits,
      'topup',
      parsed.data.source ?? `topup:${pack.id}`,
      { pack_id: pack.id, pack_name: pack.name, price_eur: pack.priceEur },
    )
    res.json({
      ok: true,
      pack:        { id: pack.id, name: pack.name, credits: pack.credits, price_eur: pack.priceEur },
      new_balance: newBalance,
    })
  } catch (err) {
    logger.error({ err, ...parsed.data }, 'POST /credits/topup failed')
    res.status(500).json({ error: 'Topup failed', code: 'TOPUP_FAILED' })
  }
})

// ── GET /api/v1/credits/packs ─────────────────────────────────────────────
// Public list of top-up packs. Used by the UI to render the buy menu.

creditsRouter.get('/credits/packs', (_req, res) => {
  res.json({
    packs: Object.values(TOPUP_PACKS).map((p) => ({
      id:        p.id,
      name:      p.name,
      credits:   p.credits,
      price_eur: p.priceEur,
    })),
  })
})

// ── GET /api/v1/credits/plans ─────────────────────────────────────────────
// Public list of plans + monthly credit quotas. Used by /pricing fallback
// and the upgrade flow.

creditsRouter.get('/credits/plans', (_req, res) => {
  res.json({
    plans: Object.entries(PLAN_MONTHLY_CREDITS).map(([id, credits]) => ({
      id,
      label: PLAN_LABELS[id as keyof typeof PLAN_LABELS],
      monthly_credits: credits,
    })),
  })
})

// ── POST /api/v1/credits/renew ────────────────────────────────────────────
// Cron entry point. HMAC-protected so an external scheduler (Render
// cron, Vercel cron, or curl-from-server) can hit it without a user
// session. Returns the count of users renewed during this run.

creditsRouter.post('/credits/renew', hmacMiddleware, async (_req, res) => {
  try {
    const count = await renewDueSubscriptions()
    res.json({ ok: true, renewed: count })
  } catch (err) {
    logger.error({ err }, 'POST /credits/renew failed')
    res.status(500).json({ error: 'Renewal failed', code: 'RENEWAL_FAILED' })
  }
})

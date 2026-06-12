/**
 * CLYRO — Credits service.
 *
 * Single backend entry point for every credit movement. Calls the
 * SECURITY DEFINER RPCs added in migration 20260428000000_credits_overhaul.sql:
 *
 *   consume_credits(user, amount, source, metadata)
 *   grant_credits  (user, amount, type, source, metadata)
 *   renew_subscription_credits()
 *
 * The API NEVER touches profiles.credits directly — every change goes
 * through here so the credit_ledger stays consistent and we have a
 * proper audit trail for billing disputes.
 */

import {
  type AnimationMode,
  type PlanId,
  PLAN_MONTHLY_CREDITS,
  creditCostForVideo as sharedCostForVideo,
  isUnlimitedPlan,
} from '@clyro/shared'
import { supabaseAdmin } from '../lib/supabase'
import { logger } from '../lib/logger'

export class InsufficientCreditsError extends Error {
  readonly code = 'INSUFFICIENT_CREDITS' as const
  readonly required: number
  readonly available: number
  constructor(required: number, available: number) {
    super(`Insufficient credits: need ${required}, have ${available}`)
    this.required = required
    this.available = available
  }
}

// ── Read helpers ──────────────────────────────────────────────────────────

export interface BalanceSnapshot {
  credits:                 number
  monthly_credits:         number
  plan:                    PlanId
  subscription_renewed_at: string | null
}

/**
 * Read the current balance + plan info. Returns null if the profile
 * doesn't exist (e.g. signup trigger not fired yet).
 */
export async function getBalance(userId: string): Promise<BalanceSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('credits, monthly_credits, plan, subscription_renewed_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logger.error({ err: error, userId }, 'getBalance: query failed')
    return null
  }
  if (!data) return null

  return {
    credits:                 data.credits as number,
    monthly_credits:         data.monthly_credits as number,
    plan:                    data.plan as PlanId,
    subscription_renewed_at: (data.subscription_renewed_at as string | null) ?? null,
  }
}

// ── Cost computation ──────────────────────────────────────────────────────

/**
 * Re-export from shared so callers don't need two imports.
 * Computes credit cost from video duration + animation mode.
 */
export function creditCostForVideo(durationSeconds: number, mode: AnimationMode): number {
  return sharedCostForVideo(durationSeconds, mode)
}

// ── Mutations ─────────────────────────────────────────────────────────────

/**
 * Atomically deduct `amount` credits from the user's balance.
 * Throws InsufficientCreditsError if the balance is too low.
 *
 * No-op (returns the current balance) if the user is on an unlimited
 * plan — useful for special-case enterprise accounts down the road.
 */
export async function deductCredits(
  userId:   string,
  amount:   number,
  source?:  string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  if (amount <= 0) {
    throw new Error(`deductCredits: amount must be positive (got ${amount})`)
  }

  // Fast-path: unlimited plans skip the RPC entirely.
  const balance = await getBalance(userId)
  if (!balance) {
    throw new Error(`deductCredits: profile ${userId} not found`)
  }
  if (isUnlimitedPlan(balance.plan)) {
    return balance.credits
  }

  const { data, error } = await supabaseAdmin.rpc('consume_credits', {
    p_user_id:  userId,
    p_amount:   amount,
    p_source:   source ?? null,
    p_metadata: metadata,
  })

  if (error) {
    // P0001 = our custom INSUFFICIENT_CREDITS sqlstate
    if (error.code === 'P0001' || /INSUFFICIENT_CREDITS/.test(error.message)) {
      throw new InsufficientCreditsError(amount, balance.credits)
    }
    logger.error({ err: error, userId, amount }, 'consume_credits RPC failed')
    throw new Error(`Credit deduction failed: ${error.message}`)
  }

  const newBalance = typeof data === 'number' ? data : balance.credits - amount
  logger.info({ userId, amount, newBalance, source }, 'Credits deducted')
  return newBalance
}

/**
 * Grant credits to a user. Used by:
 *  - subscription renewals (type='subscription')
 *  - top-up purchases (type='topup')
 *  - admin / support adjustments (type='admin_grant')
 *  - pipeline error refunds (type='refund')
 *
 * Always succeeds for valid (userId, amount > 0). Caller passes
 * `source` to identify the operation in the ledger.
 */
export async function grantCredits(
  userId:   string,
  amount:   number,
  type:     'subscription' | 'topup' | 'refund' | 'admin_grant',
  source?:  string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  if (amount <= 0) {
    throw new Error(`grantCredits: amount must be positive (got ${amount})`)
  }

  const { data, error } = await supabaseAdmin.rpc('grant_credits', {
    p_user_id:  userId,
    p_amount:   amount,
    p_type:     type,
    p_source:   source ?? null,
    p_metadata: metadata,
  })

  if (error) {
    // 23505 = unique_violation on idx_credit_ledger_refund_source (migration
    // 20260610000000): a refund with this source was already recorded. The
    // RPC normally absorbs duplicates via ON CONFLICT, but tolerate the raw
    // violation too (e.g. concurrent refunds racing) — it's a benign no-op.
    if (type === 'refund' && (error.code === '23505' || /idx_credit_ledger_refund_source|duplicate key/.test(error.message))) {
      logger.info({ userId, amount, source }, 'Duplicate refund skipped (already refunded)')
      const balance = await getBalance(userId)
      return balance?.credits ?? 0
    }
    logger.error({ err: error, userId, amount, type }, 'grant_credits RPC failed')
    throw new Error(`Credit grant failed: ${error.message}`)
  }

  const newBalance = typeof data === 'number' ? data : amount
  logger.info({ userId, amount, type, newBalance, source }, 'Credits granted')
  return newBalance
}

/**
 * Refund credits previously deducted, e.g. when a pipeline crashes
 * after deduction. Equivalent to grantCredits(..., 'refund', ...) but
 * named explicitly so error-handling code reads better.
 */
export async function refundCredits(
  userId:   string,
  amount:   number,
  source?:  string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  return grantCredits(userId, amount, 'refund', source, metadata)
}

// ── Plan / subscription state ─────────────────────────────────────────────

/**
 * Update a user's plan + monthly_credits. Used by Stripe/Moneroo
 * webhooks when an active subscription starts or changes tier.
 *
 * Does NOT grant the first month's credits — the caller is expected
 * to follow up with grantCredits(...,'subscription',...) so the
 * ledger records the grant atomically with the source (session id).
 */
export async function setPlan(userId: string, plan: PlanId): Promise<void> {
  const monthlyCredits = PLAN_MONTHLY_CREDITS[plan]
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      plan,
      monthly_credits:         monthlyCredits,
      // Reset the renewal clock so the cron grants the next month from now.
      subscription_renewed_at: plan === 'free' ? null : new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    logger.error({ err: error, userId, plan }, 'setPlan: update failed')
    throw new Error(`Failed to set plan to ${plan}`)
  }

  logger.info({ userId, plan, monthlyCredits }, 'Plan updated')
}

/**
 * Cron entry point. Returns the number of users whose monthly credits
 * were renewed during this run. Idempotent — safe to call frequently.
 */
export async function renewDueSubscriptions(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('renew_subscription_credits')
  if (error) {
    logger.error({ err: error }, 'renew_subscription_credits RPC failed')
    throw new Error(`Renewal cron failed: ${error.message}`)
  }
  const count = typeof data === 'number' ? data : 0
  logger.info({ count }, 'Subscription credits renewed')
  return count
}
